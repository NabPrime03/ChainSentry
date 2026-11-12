"""
Graph intelligence engine using NetworkX for CryptoTrace.
Constructs directed transaction graphs and performs multi-hop path tracing
with heuristic stopping conditions (Cash-out, Mixer, Cold Storage, Max Hops, Dilution).
"""
from typing import Dict, List, Set, Tuple, Optional, Any
from collections import deque
import networkx as nx

from core.models import Transaction, AddressNode, EndReceiverSummary
from core.entities import identify_entity


class TransactionGraph:
    """Manages the in-memory directed transaction graph for forensic analysis."""

    def __init__(self):
        self.graph = nx.DiGraph()

    def add_transaction(self, tx: Transaction) -> None:
        """Adds a transaction as a directed edge between sender and receiver."""
        from_addr = tx.from_address
        to_addr = tx.to_address

        # Ensure nodes exist and attribute known entities
        for addr in (from_addr, to_addr):
            if not self.graph.has_node(addr):
                etype, ename, is_term, is_mix = identify_entity(addr)
                tags = []
                if etype:
                    tags.append(f"{etype}:{ename}")
                self.graph.add_node(
                    addr,
                    tags=tags,
                    is_source=False,
                    entity_type=etype,
                    entity_name=ename,
                    is_terminal_cashout=is_term,
                    is_mixer=is_mix,
                )

        if self.graph.has_edge(from_addr, to_addr):
            edge = self.graph[from_addr][to_addr]
            edge["amount"] += tx.amount
            edge["tx_hashes"].append(tx.tx_hash)
            edge["timestamps"].append(tx.timestamp)
        else:
            self.graph.add_edge(
                from_addr,
                to_addr,
                amount=tx.amount,
                currency=tx.currency,
                tx_hashes=[tx.tx_hash],
                timestamps=[tx.timestamp],
                is_adversarial=tx.is_adversarial,
                adversarial_tag=tx.adversarial_tag,
            )

    def build_from_transactions(self, transactions: List[Transaction]) -> None:
        """Populates graph from a list of transactions."""
        for tx in transactions:
            self.add_transaction(tx)

    def get_address_node(self, address: str, hop_distance: Optional[int] = None) -> AddressNode:
        """Computes live degree, flow, and balance metrics for an address."""
        if not self.graph.has_node(address):
            return AddressNode(address=address)

        in_edges = self.graph.in_edges(address, data=True)
        out_edges = self.graph.out_edges(address, data=True)

        total_received = sum(data.get("amount", 0.0) for _, _, data in in_edges)
        total_sent = sum(data.get("amount", 0.0) for _, _, data in out_edges)
        node_attrs = self.graph.nodes[address]

        return AddressNode(
            address=address,
            in_degree=self.graph.in_degree(address),
            out_degree=self.graph.out_degree(address),
            total_received=round(total_received, 6),
            total_sent=round(total_sent, 6),
            balance_estimate=round(total_received - total_sent, 6),
            tags=node_attrs.get("tags", []),
            is_source=node_attrs.get("is_source", False),
            hop_distance=hop_distance,
        )

    def trace_forward(
        self,
        source_address: str,
        max_hops: int = 3,
        min_amount_threshold: float = 0.0,
        max_branches_per_node: Optional[int] = 10,
    ) -> Dict[str, Any]:
        """
        Executes a priority-weighted multi-hop forward BFS trace from the source address.
        Evaluates the 4 forensic stopping conditions:
          1. Terminal Cash-Out (Exchange) or Mixer Pool
          2. Cold Storage Sink (zero outgoing transfers)
          3. Max Hops Boundary reached
          4. Value Dilution / Pruning (< min_amount_threshold)
        """
        if not self.graph.has_node(source_address):
            return {
                "visited_nodes": [],
                "end_receivers": [],
                "subgraph_edges": [],
            }

        # Mark source
        self.graph.nodes[source_address]["is_source"] = True

        visited_nodes: Dict[str, int] = {source_address: 0}
        queue = deque([(source_address, 0, [source_address])])
        subgraph_edges = []
        end_receivers_map: Dict[str, EndReceiverSummary] = {}

        while queue:
            curr_addr, hops, current_path = queue.popleft()

            if hops >= max_hops:
                continue

            # Prioritize outgoing transfers by amount descending (follow the main money flow first!)
            successors = sorted(
                self.graph.successors(curr_addr),
                key=lambda x: self.graph[curr_addr][x].get("amount", 0.0),
                reverse=True,
            )
            if max_branches_per_node is not None and len(successors) > max_branches_per_node:
                successors = successors[:max_branches_per_node]

            for next_addr in successors:
                edge_data = self.graph[curr_addr][next_addr]
                amount = edge_data.get("amount", 0.0)

                # Stopping Condition 4: Value Dilution / Sub-threshold Pruning
                if amount < min_amount_threshold:
                    continue

                subgraph_edges.append((curr_addr, next_addr, edge_data))
                new_path = current_path + [next_addr]
                new_hops = hops + 1

                if next_addr not in visited_nodes or new_hops < visited_nodes[next_addr]:
                    visited_nodes[next_addr] = new_hops

                node_attrs = self.graph.nodes.get(next_addr, {})
                etype, ename, is_term, is_mix = identify_entity(next_addr)
                out_deg = self.graph.out_degree(next_addr)

                should_stop_branch = False
                stopping_reason = ""

                # Stopping Condition 1: Terminal Cashout at Exchange or Mixer Tumbler
                if is_term or is_mix:
                    should_stop_branch = True
                    if is_mix:
                        stopping_reason = f"Mixer Tumbler Pool Detected: {ename}"
                    else:
                        stopping_reason = f"Terminal Cash-out Point Detected: {ename}"
                # Stopping Condition 2: Cold Storage Sink (Funds unspent)
                elif out_deg == 0:
                    should_stop_branch = True
                    stopping_reason = "Cold Storage Sink: funds unspent (out-degree: 0)"
                # Stopping Condition 3: Reached Max Hops Limit
                elif new_hops == max_hops:
                    should_stop_branch = True
                    stopping_reason = f"Max search depth boundary reached ({max_hops} hops)"

                if should_stop_branch:
                    self.graph.nodes[next_addr]["stopping_reason"] = stopping_reason
                    tags = list(node_attrs.get("tags", []))
                    if etype and f"{etype}:{ename}" not in tags:
                        tags.append(f"{etype}:{ename}")

                    end_receivers_map[next_addr] = EndReceiverSummary(
                        address=next_addr,
                        hop_depth=new_hops,
                        amount_reached=round(amount, 6),
                        path=new_path,
                        stopping_reason=stopping_reason,
                        entity_type=etype,
                        entity_name=ename,
                        is_terminal_cashout=is_term,
                        is_mixer=is_mix,
                        tags=tags,
                        is_sink=(out_deg == 0 or is_term or is_mix),
                    )
                else:
                    # Continue expanding this branch in the loop
                    if new_hops < max_hops:
                        queue.append((next_addr, new_hops, new_path))

        nodes_summary = [
            self.get_address_node(addr, hop_distance=hop)
            for addr, hop in visited_nodes.items()
        ]

        # Sort end receivers by amount received descending
        ranked_end_receivers = sorted(
            end_receivers_map.values(), key=lambda r: r.amount_reached, reverse=True
        )

        return {
            "visited_nodes": nodes_summary,
            "end_receivers": ranked_end_receivers,
            "subgraph_edges": subgraph_edges,
        }
