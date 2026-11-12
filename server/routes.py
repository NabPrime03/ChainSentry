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
from cybersecurity.audit_trail import AuditTrail
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
    Accepts a suspicious address, extracts transaction data via recursive multi-hop crawl,
    builds the NetworkX directed graph, discovers multi-hop fund flows, maintains a cryptographic
    audit trail of all visited nodes and stopping decisions, and compiles an interactive visualization.
    """
    start_time = time.time()
    target_addr = request.target_address.strip()

    if not target_addr:
        raise HTTPException(status_code=400, detail="Target address cannot be empty.")

    # 1. Initialize tamper-evident cryptographic audit trail
    audit = AuditTrail(target_address=target_addr)

    # 2. Ingest transactions via recursive multi-hop crawler
    transactions = provider.crawl_multihop_transactions(
        root_address=target_addr,
        max_hops=request.max_hops,
        min_amount_threshold=request.min_amount_threshold,
    )

    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transaction records found for address {target_addr}.",
        )

    audit.record_step(
        step_type="INGESTION_COMPLETE",
        node_address=target_addr,
        hop_depth=0,
        details={
            "transactions_count": len(transactions),
            "max_hops_requested": request.max_hops,
            "min_amount_threshold": request.min_amount_threshold,
        },
    )

    # 3. Build NetworkX transaction graph
    tx_graph = TransactionGraph()
    tx_graph.build_from_transactions(transactions)

    # 4. Perform multi-hop forward trace from target address
    trace_result = tx_graph.trace_forward(
        source_address=target_addr,
        max_hops=request.max_hops,
        min_amount_threshold=request.min_amount_threshold,
    )

    visited_nodes_list = trace_result["visited_nodes"]
    end_receivers_list = trace_result["end_receivers"]
    visited_addrs = {n.address for n in visited_nodes_list}

    # 5. Record visited nodes and forensic stopping points in audit trail
    for node in visited_nodes_list:
        audit.record_step(
            step_type="NODE_VISITED",
            node_address=node.address,
            hop_depth=node.hop_distance if node.hop_distance is not None else 0,
            details={
                "in_degree": node.in_degree,
                "out_degree": node.out_degree,
                "total_sent": node.total_sent,
                "total_received": node.total_received,
                "is_source": node.is_source,
                "tags": node.tags,
            },
        )

    for receiver in end_receivers_list:
        audit.record_step(
            step_type="STOPPING_CONDITION",
            node_address=receiver.address,
            hop_depth=receiver.hop_depth,
            details={
                "stopping_reason": receiver.stopping_reason,
                "amount_reached": receiver.amount_reached,
                "entity_name": receiver.entity_name,
                "entity_type": receiver.entity_type,
                "path": receiver.path,
            },
        )

    audit.record_step(
        step_type="INVESTIGATION_CONCLUDED",
        node_address=target_addr,
        hop_depth=request.max_hops,
        details={
            "total_nodes_visited": len(visited_nodes_list),
            "total_end_receivers": len(end_receivers_list),
            "audit_chain_valid": audit.verify_integrity(),
        },
    )

    # 6. Generate PyVis interactive HTML if requested
    viz_available = False
    viz_path = os.path.join(SERVER_DIR, "static", "trace_graph.html")
    if request.generate_viz:
        try:
            render_trace_to_html(
                tx_graph,
                source_address=target_addr,
                output_filepath=viz_path,
                filter_nodes=visited_addrs,
            )
            viz_available = True
        except Exception as exc:
            # Non-fatal if visualization rendering has issues
            viz_available = False

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    # Filter and cap returned transactions to those involving visited nodes (up to 100 max)
    # This prevents megabytes of raw transactions from choking the HTTP client / frontend
    relevant_transactions = [
        tx for tx in transactions
        if tx.from_address in visited_addrs or tx.to_address in visited_addrs
    ]
    relevant_transactions.sort(key=lambda t: t.amount, reverse=True)
    capped_transactions = relevant_transactions[:100]

    return TraceResponse(
        target_address=target_addr,
        currency=request.currency,
        max_hops=request.max_hops,
        total_nodes=len(visited_nodes_list),
        total_edges=len(trace_result["subgraph_edges"]),
        nodes=visited_nodes_list,
        transactions=capped_transactions,
        end_receivers=end_receivers_list,
        viz_html_available=viz_available,
        viz_html_path=f"/api/v1/graph/html?address={target_addr}" if viz_available else None,
        audit_trail=audit.to_dict(),
        execution_time_ms=elapsed_ms,
    )


@router.get("/graph/html", response_class=HTMLResponse)
def view_graph_html(
    address: str = Query(default=HACKER_SOURCE_BTC),
    force_refresh: bool = Query(default=False),
):
    """
    Serves the interactive PyVis graph directly in any browser tab.
    Serves the pre-compiled graph instantly if available.
    """
    filepath = os.path.join(SERVER_DIR, "static", "trace_graph.html")
    clean_addr = address.strip()

    # Fast path: serve instantly if already generated and force_refresh is not requested
    if os.path.exists(filepath) and not force_refresh:
        with open(filepath, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())

    # On-demand generation path (uses in-memory cached transactions)
    transactions = provider.crawl_multihop_transactions(clean_addr, max_hops=3)
    tx_graph = TransactionGraph()
    tx_graph.build_from_transactions(transactions)
    res = tx_graph.trace_forward(source_address=clean_addr, max_hops=3)
    visited_addrs = {n.address for n in res["visited_nodes"]}
    render_trace_to_html(
        tx_graph,
        source_address=clean_addr,
        output_filepath=filepath,
        filter_nodes=visited_addrs,
    )

    with open(filepath, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
