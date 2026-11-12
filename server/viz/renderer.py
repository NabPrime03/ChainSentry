"""
PyVis-based interactive HTML graph generator for CryptoTrace.
Renders physics-enabled, color-coded transaction trails with forensic tags.
"""
import os
from typing import Optional
from pyvis.network import Network
import networkx as nx

from core.graph import TransactionGraph


def render_trace_to_html(
    tx_graph: TransactionGraph,
    source_address: str,
    output_filepath: str = "static/trace_graph.html",
    height: str = "750px",
    width: str = "100%",
) -> str:
    """
    Renders the NetworkX transaction graph to an interactive HTML document via PyVis.
    Nodes are color-coded based on forensic role (Source, Intermediary, Sink, Adversarial).
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_filepath)), exist_ok=True)

    net = Network(height=height, width=width, directed=True, bgcolor="#0f172a", font_color="#f8fafc")
    net.force_atlas_2based(gravity=-60, central_gravity=0.01, spring_length=120, damping=0.9)

    g = tx_graph.graph

    for node in g.nodes():
        node_data = g.nodes[node]
        in_deg = g.in_degree(node)
        out_deg = g.out_degree(node)

        # Truncate address for clean display label
        short_label = f"{node[:6]}...{node[-4:]}" if len(node) > 14 else node

        # Color coding logic
        if node == source_address:
            color = "#ef4444"  # Red for Hacker / Source
            title = f"SUSPICIOUS SOURCE WALLET<br>Address: {node}"
            size = 35
        elif out_deg == 0:
            color = "#10b981"  # Green for End Receiver / Cashout
            title = f"END RECEIVER (SINK)<br>Address: {node}<br>In-degree: {in_deg}"
            size = 28
        else:
            color = "#f59e0b"  # Amber for Intermediary Hop / Peel
            title = f"INTERMEDIARY HOP<br>Address: {node}<br>In: {in_deg}, Out: {out_deg}"
            size = 22

        net.add_node(
            node,
            label=short_label,
            title=title,
            color=color,
            size=size,
            shape="dot",
            font={"size": 13, "color": "#f8fafc"},
        )

    for u, v, data in g.edges(data=True):
        amount = data.get("amount", 0.0)
        currency = data.get("currency", "BTC")
        is_adv = data.get("is_adversarial", False)
        adv_tag = data.get("adversarial_tag", "")

        label = f"{amount} {currency}"
        title = f"Flow: {amount} {currency}<br>TX Count: {len(data.get('tx_hashes', []))}"

        if is_adv:
            edge_color = "#94a3b8"  # Slate/Gray for adversarial noise
            dashes = True
            title += f"<br><b>WARNING: {adv_tag}</b>"
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

    # Disable default PyVis cdn banner/heading if possible
    net.save_graph(output_filepath)
    return output_filepath
