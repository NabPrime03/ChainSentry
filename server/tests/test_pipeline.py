"""
Unit and integration tests for CryptoTrace backend.
Verifies data ingestion, graph building, multi-hop tracing, and FastAPI endpoints.
"""
import os
import sys
from fastapi.testclient import TestClient

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

try:
    from main import app
except ImportError:
    from server.main import app
from core.models import Transaction
from core.graph import TransactionGraph
from ingestion.live_api import UnifiedBlockchainProvider
from ingestion.benchmark import (
    HACKER_SOURCE_BTC,
    EXCHANGE_CASHOUT_BTC,
    DUSTING_VICTIM_BTC,
)

client = TestClient(app)


def test_healthcheck():
    """Verify service health endpoint."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_list_benchmarks():
    """Verify available benchmark scenarios endpoint."""
    resp = client.get("/api/v1/benchmarks")
    assert resp.status_code == 200
    scenarios = resp.json()["scenarios"]
    assert len(scenarios) >= 2
    assert scenarios[0]["id"] == "btc_peel_chain"


def test_graph_construction_and_trace():
    """Verify NetworkX graph builds correctly and traces 3 hops to Binance."""
    provider = UnifiedBlockchainProvider()
    txs = provider.fetch_transactions_for_address(HACKER_SOURCE_BTC)
    assert len(txs) > 0

    tx_graph = TransactionGraph()
    tx_graph.build_from_transactions(txs)

    # Check node presence
    assert tx_graph.graph.has_node(HACKER_SOURCE_BTC)
    assert tx_graph.graph.has_node(EXCHANGE_CASHOUT_BTC)
    assert tx_graph.graph.has_node(DUSTING_VICTIM_BTC)

    # Perform 3-hop trace
    trace_res = tx_graph.trace_forward(HACKER_SOURCE_BTC, max_hops=3)

    visited_addrs = [node.address for node in trace_res["visited_nodes"]]
    assert HACKER_SOURCE_BTC in visited_addrs
    assert EXCHANGE_CASHOUT_BTC in visited_addrs

    # Verify end receivers list contains Binance cashout
    receivers = [r.address for r in trace_res["end_receivers"]]
    assert EXCHANGE_CASHOUT_BTC in receivers


def test_api_trace_endpoint():
    """Verify POST /api/v1/trace endpoint with hacker address."""
    payload = {
        "target_address": HACKER_SOURCE_BTC,
        "max_hops": 3,
        "currency": "BTC",
        "generate_viz": True,
    }
    resp = client.post("/api/v1/trace", json=payload)
    assert resp.status_code == 200
    body = resp.json()

    assert body["target_address"] == HACKER_SOURCE_BTC
    assert body["total_nodes"] >= 4
    assert body["total_edges"] >= 4
    assert body["viz_html_available"] is True
    assert len(body["end_receivers"]) > 0


def test_graph_html_endpoint():
    """Verify HTML visualization endpoint returns valid HTML."""
    resp = client.get(f"/api/v1/graph/html?address={HACKER_SOURCE_BTC}")
    assert resp.status_code == 200
    assert "html" in resp.headers.get("content-type", "")
    assert "<html" in resp.text.lower()
