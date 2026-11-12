"""
Graph intelligence engine using NetworkX for CryptoTrace.
Constructs directed transaction graphs and performs multi-hop path tracing.
"""
from typing import Dict, List, Set, Tuple, Optional, Any
from collections import deque
import networkx as nx

from core.models import Transaction, AddressNode, EndReceiverSummary


class TransactionGraph:
    """Manages the in-memory directed transaction graph for forensic analysis."""

    def __init__(self):
        self.graph = nx.DiGraph()

    def add_transaction(self, tx: Transaction) -> None:
        """Adds a transaction as a directed edge between sender and receiver."""
        from_addr = tx.from_address
        to_addr = tx.to_address

        # Ensure nodes exist
        if not self.graph.has_node(from_addr):
            self.graph.add_node(from_addr, tags=[], is_source=False)
        if not self.graph.has_node(to_addr):
            self.graph.add_node(to_addr, tags=[], is_source=False)

        # In NetworkX MultiDiGraph or DiGraph, we can store aggregate or list of edges.
        # For our forensic tracer, we store the edge with transaction metadata.
        if self.graph.has_edge(from_addr, to_addr):
            # Accumulate amount and preserve tx history
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
    ) -> Dict[str, Any]:
        """
        Executes a multi-hop forward BFS trace from the source address.
        Identifies all reachable downstream addresses, paths, and potential end receivers.
        """
        if not self.graph.has_node(source_address):
            return {
                "visited_nodes": [],
                "end_receivers": [],
                "subgraph_nodes": [],
                "subgraph_edges": [],
            }

        # Mark source
        self.graph.nodes[source_address]["is_source"] = True

        visited_nodes: Dict[str, int] = {source_address: 0}  # address -> hop_depth
        queue = deque([(source_address, 0, [source_address])])  # (curr, hops, path)
        paths_discovered: List[Tuple[List[str], float]] = []
        end_receivers: List[EndReceiverSummary] = []
        subgraph_edges = []

        while queue:
            curr_addr, hops, current_path = queue.popleft()

            if hops >= max_hops:
                continue

            for next_addr in self.graph.successors(curr_addr):
                edge_data = self.graph[curr_addr][next_addr]
                amount = edge_data.get("amount", 0.0)

                # Skip edges below threshold if specified
                if amount < min_amount_threshold:
                    continue

                subgraph_edges.append((curr_addr, next_addr, edge_data))
                new_path = current_path + [next_addr]
                new_hops = hops + 1

                # Record path
                paths_discovered.append((new_path, amount))

                # Update visited distance (shortest hop recorded)
                if next_addr not in visited_nodes or new_hops < visited_nodes[next_addr]:
                    visited_nodes[next_addr] = new_hops

                # If this address has no further outgoing transactions or reaches max_hops,
                # it is a candidate end receiver (sink)
                out_deg = self.graph.out_degree(next_addr)
                is_sink = (out_deg == 0) or (new_hops == max_hops)

                if is_sink:
                    # Collect end receiver summary
                    tags = self.graph.nodes[next_addr].get("tags", [])
                    end_receivers.append(
                        EndReceiverSummary(
                            address=next_addr,
                            hop_depth=new_hops,
                            amount_reached=round(amount, 6),
                            path=new_path,
                            tags=tags,
                            is_sink=(out_deg == 0),
                        )
                    )

                if new_hops < max_hops:
                    queue.append((next_addr, new_hops, new_path))

        # Build AddressNode list for all visited addresses
        nodes_summary = [
            self.get_address_node(addr, hop_distance=hop)
            for addr, hop in visited_nodes.items()
        ]

        return {
            "visited_nodes": nodes_summary,
            "end_receivers": end_receivers,
            "subgraph_edges": subgraph_edges,
        }
