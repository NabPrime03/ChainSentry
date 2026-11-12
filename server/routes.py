"""
FastAPI route definitions for CryptoTrace.
Provides endpoints for initiating forensic traces, retrieving graph data,
and inspecting benchmark scenarios.
"""
import time
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse

from core.models import TraceRequest, TraceResponse
from core.graph import TransactionGraph
from ingestion.live_api import UnifiedBlockchainProvider
from ingestion.benchmark import (
    HACKER_SOURCE_BTC,
    EXCHANGE_CASHOUT_BTC,
    MIXER_SOURCE_ETH,
    MIXER_POOL_ETH,
)
from viz.renderer import render_trace_to_html

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
router = APIRouter(prefix="/api/v1")
provider = UnifiedBlockchainProvider()


@router.get("/health")
def healthcheck():
    """Confirms API service status and operational readiness."""
    return {"status": "ok", "service": "CryptoTrace Forensic Backend", "version": "1.0.0"}


@router.get("/benchmarks")
def list_benchmarks():
    """Lists available pre-packaged forensic benchmark scenarios for evaluation."""
    return {
        "description": "Deterministic forensic scenarios for testing without live API throttling",
        "scenarios": [
            {
                "id": "btc_peel_chain",
                "name": "Bitcoin Ransomware 3-Hop Peel Chain + Dusting + Poisoning",
                "source_address": HACKER_SOURCE_BTC,
                "currency": "BTC",
                "expected_destination": EXCHANGE_CASHOUT_BTC,
                "adversarial_features": ["Dusting Attack (0.00008 BTC)", "Address Poisoning (0.0 BTC)"],
            },
            {
                "id": "eth_mixer_pool",
                "name": "Ethereum Tumbler / Mixer Fan-In Fan-Out",
                "source_address": MIXER_SOURCE_ETH,
                "currency": "ETH",
                "mixer_contract": MIXER_POOL_ETH,
                "adversarial_features": ["Equal-denomination splitting", "Temporal delay"],
            },
        ],
    }


@router.post("/trace", response_model=TraceResponse)
def trace_address(request: TraceRequest):
    """
    Main forensic tracing endpoint.
    Accepts a suspicious address, extracts transaction data, builds the NetworkX
    directed graph, discovers multi-hop fund flows, and compiles an interactive visualization.
    """
    start_time = time.time()
    target_addr = request.target_address.strip()

    if not target_addr:
        raise HTTPException(status_code=400, detail="Target address cannot be empty.")

    # 1. Fetch transactions (Live API with benchmark fallback)
    transactions = provider.fetch_transactions_for_address(target_addr)

    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transaction records found for address {target_addr}.",
        )

    # 2. Build NetworkX transaction graph
    tx_graph = TransactionGraph()
    tx_graph.build_from_transactions(transactions)

    # 3. Perform multi-hop forward trace from target address
    trace_result = tx_graph.trace_forward(
        source_address=target_addr,
        max_hops=request.max_hops,
        min_amount_threshold=request.min_amount_threshold,
    )

    # 4. Generate PyVis interactive HTML if requested
    viz_available = False
    viz_path = os.path.join(SERVER_DIR, "static", "trace_graph.html")
    if request.generate_viz:
        try:
            render_trace_to_html(tx_graph, source_address=target_addr, output_filepath=viz_path)
            viz_available = True
        except Exception as exc:
            # Non-fatal if visualization rendering has issues
            viz_available = False

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return TraceResponse(
        target_address=target_addr,
        currency=request.currency,
        max_hops=request.max_hops,
        total_nodes=len(trace_result["visited_nodes"]),
        total_edges=len(trace_result["subgraph_edges"]),
        nodes=trace_result["visited_nodes"],
        transactions=transactions,
        end_receivers=trace_result["end_receivers"],
        viz_html_available=viz_available,
        viz_html_path=f"/api/v1/graph/html?address={target_addr}" if viz_available else None,
        execution_time_ms=elapsed_ms,
    )


@router.get("/graph/html", response_class=HTMLResponse)
def view_graph_html(address: str = Query(default=HACKER_SOURCE_BTC)):
    """Serves the interactive PyVis graph directly in any browser tab."""
    filepath = os.path.join(SERVER_DIR, "static", "trace_graph.html")
    if not os.path.exists(filepath):
        # Auto-generate if missing
        transactions = provider.fetch_transactions_for_address(address)
        tx_graph = TransactionGraph()
        tx_graph.build_from_transactions(transactions)
        render_trace_to_html(tx_graph, source_address=address, output_filepath=filepath)

    with open(filepath, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
