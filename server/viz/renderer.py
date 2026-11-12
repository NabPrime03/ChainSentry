"""
PyVis-based interactive HTML graph generator for CryptoTrace.
Renders physics-enabled, color-coded transaction trails with forensic tags,
entity attributes, and stopping conditions.
"""

import os
from typing import Optional, Set
from pyvis.network import Network
import networkx as nx

from core.graph import TransactionGraph


def render_trace_to_html(
    tx_graph: TransactionGraph,
    source_address: str,
    output_filepath: str = "static/trace_graph.html",
    height: str = "750px",
    width: str = "100%",
    filter_nodes: Optional[Set[str]] = None,
) -> str:
    """
    Renders the NetworkX transaction graph to an interactive HTML document via PyVis.
    Nodes are color-coded based on forensic role:
      - 🔴 Red: Suspicious Source (Hacker)
      - 🟢 Emerald: Terminal Exchange Cash-Out (Binance, Coinbase)
      - 🟣 Purple: Mixer / Tumbler Pool (Tornado Cash)
      - 🟡 Amber: Intermediary Peel Hop
      - 🔵 Cyan: Cold Storage Sink
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_filepath)), exist_ok=True)

    net = Network(
        height=height,
        width=width,
        directed=True,
        bgcolor="#0f172a",
        font_color="#f8fafc",
    )
    net.force_atlas_2based(
        gravity=-60, central_gravity=0.01, spring_length=200, damping=0.9
    )

    g = tx_graph.graph
    target_nodes = set(g.nodes()) if filter_nodes is None else (set(filter_nodes) | {source_address})

    for node in target_nodes:
        if not g.has_node(node):
            continue
        node_data = g.nodes[node]
        in_deg = g.in_degree(node)
        out_deg = g.out_degree(node)
        is_cashout = node_data.get("is_terminal_cashout", False)
        is_mixer = node_data.get("is_mixer", False)
        ename = node_data.get("entity_name")
        etype = node_data.get("entity_type")

        # Truncate address for clean display label
        short_label = f"{node[:6]}...{node[-4:]}" if len(node) > 16 else node
        if ename and "binance" in ename.lower():
            short_label = "Binance Cashout"
        elif ename and "tornado" in ename.lower():
            short_label = "Tornado Cash Pool"

        # Forensic Role Styling
        if node == source_address:
            color = "#ef4444"  # Red
            shape = "dot"
            size = 35
            title = f"<b>🚨 SUSPICIOUS SOURCE WALLET</b><br>Address: {node}"
        elif is_cashout and not is_mixer:
            color = "#10b981"  # Emerald Green
            shape = "diamond"
            size = 32
            title = f"<b>🎯 TERMINAL CASHOUT ENDPOINT</b><br>Entity: {ename or 'Centralized Exchange'}<br>Address: {node}"
        elif is_mixer:
            color = "#a855f7"  # Purple
            shape = "star"
            size = 32
            title = f"<b>🌪️ MIXER / TUMBLER POOL</b><br>Entity: {ename or 'Mixer Service'}<br>Address: {node}"
        elif out_deg == 0:
            color = "#06b6d4"  # Cyan
            shape = "dot"
            size = 25
            title = f"<b>❄️ COLD STORAGE SINK (UNSPENT)</b><br>Address: {node}<br>In-degree: {in_deg}"
        else:
            color = "#f59e0b"  # Amber
            shape = "dot"
            size = 22
            title = f"<b>🔄 INTERMEDIARY PEEL HOP</b><br>Address: {node}<br>In: {in_deg}, Out: {out_deg}"

        stop_reason = node_data.get("stopping_reason")
        if stop_reason:
            title += f"<br><br><b>🛑 Stopping Reason:</b> {stop_reason}"

        net.add_node(
            node,
            label=short_label,
            title=title,
            color=color,
            size=size,
            shape=shape,
            font={"size": 13, "color": "#f8fafc"},
        )

    for u, v, data in g.edges(data=True):
        if filter_nodes is not None and (u not in target_nodes or v not in target_nodes):
            continue
        amount = data.get("amount", 0.0)
        currency = data.get("currency", "BTC")
        is_adv = data.get("is_adversarial", False)
        adv_tag = data.get("adversarial_tag", "")

        label = f"{amount} {currency}"
        title = (
            f"Flow: {amount} {currency}<br>TX Count: {len(data.get('tx_hashes', []))}"
        )

        if is_adv:
            edge_color = "#94a3b8"  # Slate/Gray for adversarial noise
            dashes = True
            title += f"<br><b>⚠️ ADVERSARIAL EVENT: {adv_tag}</b>"
        else:
            edge_color = "#38bdf8"  # Bright cyan for genuine flow
            dashes = False

        net.add_edge(
            u,
            v,
            value=max(1.0, amount),
            title=title,
            label=label,
            color=edge_color,
            dashes=dashes,
            arrows="to",
        )

    net.save_graph(output_filepath)
    return output_filepath
