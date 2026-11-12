# CryptoTrace 🛡️🔍
### Confidence-Aware Blockchain Forensics & Adversarial Transaction Detection

> **Status:** Backend Core Implemented & Tested (FastAPI + NetworkX + PyVis + Ingestion Layer)  
> **Package Manager:** `uv`  
> **Repository Layout:** Clean Monorepo (`server/` for backend, `client/` for frontend, `docs/` for integration)

---

## 1. What Has Been Implemented (Milestone 1)

This milestone establishes the end-to-end backend pipeline to verify **data extraction, graph construction, multi-hop path tracing, interactive visualization, and FastAPI routing**:

1. **FastAPI Backend (`server/`):**
   - Single unified server file (`server/main.py`) with full **CORS middleware** (ready for the React/Next.js frontend team on any port).
   - `POST /api/v1/trace`: Accepts a suspicious address, builds the graph, and returns nodes, edges, and reachable end receivers.
   - `GET /api/v1/graph/html`: Serves the interactive PyVis graph directly in any browser or `<iframe>`.
   - `GET /api/v1/benchmarks`: Provides pre-packaged ground-truth scenarios for demo and testing.
   - `GET /api/v1/health`: Operational health check.

2. **Blockchain Data Ingestion (`server/ingestion/`):**
   - **Live APIs:** Blockstream Esplora API for Bitcoin and Etherscan API for Ethereum.
   - **Forensic Benchmark Corpus:** Built-in reproducible scenarios:
     - **Bitcoin Ransomware Heist:** 3-hop peel chain leading to a Binance deposit exchange cashout, combined with an active **dusting attack** (0.00008 BTC) and **address poisoning** (0.0 BTC) to test adversarial defense.
     - **Ethereum Tumbler/Mixer:** Fan-in and fan-out laundering pattern.

3. **Graph Intelligence Engine (`server/core/`):**
   - In-memory directed graph using **`NetworkX`** (`DiGraph`).
   - Multi-hop forward **BFS path tracing** from source wallet to end receivers.
   - Real-time in-degree, out-degree, total received, total sent, and balance estimations.
   - Identification of transaction sinks (end receivers).

4. **Interactive Visualization Engine (`server/viz/`):**
   - Built with **`PyVis`** using ForceAtlas2 physics simulation.
   - **Color-coded forensic roles:**
     - 🔴 **Red Node:** Suspicious Source Wallet (Hacker)
     - 🟡 **Amber Nodes:** Intermediary Peel Chain Hops
     - 🟢 **Green Nodes:** Destination Sinks / Exchange Cash-out
     - 🌫️ **Dotted Edges:** Adversarial Traps (Dusting / Poisoning) with warning tooltips.

5. **Documentation & Architecture Guide (`docs/architecture.md`):**
   - Complete technical specification and API contracts formatted for the frontend team.

---

## 2. Project Directory Structure

```
cryptotrace/
├── server/                # Complete Python Backend Engine
│   ├── main.py            # Unified server entrypoint & FastAPI app
│   ├── routes.py          # API route endpoints (/trace, /benchmarks, /graph/html)
│   ├── requirements.txt   # Backend dependencies
│   ├── core/              # NetworkX Graph engine & Pydantic models
│   │   ├── models.py      # Transaction, AddressNode, TraceResponse models
│   │   └── graph.py       # Graph builder & BFS forward-tracer
│   ├── ingestion/         # Live APIs (Bitcoin/Ethereum) & forensic benchmarks
│   │   ├── base.py        # Abstract provider interface
│   │   ├── live_api.py    # Blockstream & Etherscan API client
│   │   └── benchmark.py   # Ground-truth test scenarios
│   ├── viz/               # PyVis interactive HTML renderer
│   │   └── renderer.py    # Physics network graph generator
│   ├── static/            # Generated visual assets (trace_graph.html)
│   └── tests/             # Automated test suite
│       └── test_pipeline.py
│
├── client/                # Reserved for Frontend Team (React / Next.js)
│   └── README.md          # Frontend integration guide
│
└── docs/                  # Architecture & integration specifications
    └── architecture.md
```

---

## 3. End-to-End Workflow (File-to-File Data Journey)

```
Client / Frontend UI
     │
     ▼ (1. Sends HTTP POST Request)
server/main.py ─────────► Listens on port 8000, checks CORS, forwards to routes
     │
     ▼ (2. Route Matching)
server/routes.py ────────► Validates input using server/core/models.py (TraceRequest)
     │
     ▼ (3. Data Ingestion)
server/ingestion/live_api.py + benchmark.py ──► Fetches raw transactions & standardizes them
     │
     ▼ (4. Graph Intelligence)
server/core/graph.py ────► Builds NetworkX DiGraph & runs multi-hop BFS path tracing
     │
     ▼ (5. Visualization Engine)
server/viz/renderer.py ──► PyVis generates interactive HTML (static/trace_graph.html)
     │
     ▼ (6. Response Packaging)
server/routes.py ────────► Bundles discovered nodes & sinks into JSON Response (~18ms)
```

---

## 4. API Input Specification (`POST /api/v1/trace`)

### Minimal Input
Only `target_address` is strictly required. All other parameters have smart defaults:
```json
{
  "target_address": "bc1q_hacker_ransomware_vault"
}
```

### Full Configurable Input
```json
{
  "target_address": "bc1q_hacker_ransomware_vault",
  "max_hops": 3,
  "currency": "BTC",
  "min_amount_threshold": 0.001,
  "generate_viz": true
}
```

### Input Parameters Reference

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `target_address` | `string` | **Yes** | — | Suspicious source wallet address to investigate. |
| `max_hops` | `integer` | No | `3` | Max forward traversal depth (1 to 10 jumps). |
| `currency` | `string` | No | `"BTC"` | Cryptocurrency type (`"BTC"` or `"ETH"`). |
| `min_amount_threshold` | `float` | No | `0.0` | Filter out tiny transfers below this threshold (e.g. `0.001` BTC). |
| `generate_viz` | `boolean` | No | `true` | Whether to compile the PyVis interactive HTML graph. |

---

## 5. API Output Specification

When tracing completes, the API returns two outputs:

### Output A: Structured JSON Response
```json
{
  "target_address": "bc1q_hacker_ransomware_vault",
  "currency": "BTC",
  "max_hops": 3,
  "total_nodes": 9,
  "total_edges": 8,
  "execution_time_ms": 18.69,
  "nodes": [
    {
      "address": "bc1q_hacker_ransomware_vault",
      "in_degree": 0,
      "out_degree": 4,
      "total_received": 0.0,
      "total_sent": 49.90008,
      "balance_estimate": -49.90008,
      "is_source": true,
      "hop_distance": 0
    },
    {
      "address": "bc1q_binance_deposit_exchange",
      "in_degree": 1,
      "out_degree": 0,
      "total_received": 40.0,
      "total_sent": 0.0,
      "balance_estimate": 40.0,
      "is_source": false,
      "hop_distance": 3
    }
  ],
  "end_receivers": [
    {
      "address": "bc1q_binance_deposit_exchange",
      "hop_depth": 3,
      "amount_reached": 40.0,
      "path": [
        "bc1q_hacker_ransomware_vault",
        "bc1q_change_hop1",
        "bc1q_change_hop2",
        "bc1q_binance_deposit_exchange"
      ],
      "is_sink": true
    }
  ],
  "viz_html_available": true,
  "viz_html_path": "/api/v1/graph/html?address=bc1q_hacker_ransomware_vault"
}
```

### Output B: Interactive Visual Network (`/api/v1/graph/html`)
- Opens directly in any browser or embeds seamlessly into an `<iframe>` inside the React dashboard.
- **Physics simulation:** Drag nodes around, zoom in/out, hover over addresses for detailed metrics.
- **Color-coded:**
  - 🔴 **Red:** Source hacker wallet
  - 🟡 **Amber:** Intermediary peel-chain hops
  - 🟢 **Green:** Final destination wallets / cash-out exchanges
  - 🌫️ **Dotted lines:** Adversarial dusting & look-alike poisoning attempts

---

## 6. How to Run and Test (Using `uv`)

### Step 1: Install Dependencies
```bash
# In the project root:
uv venv
uv pip install -r server/requirements.txt
```

### Step 2: Run the Automated Test Suite
```bash
# Run tests from server/ or root:
uv run pytest server/
```
*(All 5 tests pass in ~0.5s)*

### Step 3: Start the Backend Server
```bash
cd server
uv run python main.py
```
The server will start at `http://localhost:8000`:
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Direct Interactive Graph:** [http://localhost:8000/api/v1/graph/html](http://localhost:8000/api/v1/graph/html)

### Quick Test via `curl`:
```bash
curl -X POST "http://localhost:8000/api/v1/trace" \
  -H "Content-Type: application/json" \
  -d '{
    "target_address": "bc1q_hacker_ransomware_vault",
    "max_hops": 3,
    "currency": "BTC",
    "generate_viz": true
  }'
```

---

## 7. Next Planned Milestones
- **Milestone 2:** Heuristic Engine (Automated Peel-Chain recognition, change-output identification, and mixer signatures).
- **Milestone 3:** Cybersecurity Defense Layer (Automated dusting filtering and look-alike address poisoning detection).
- **Milestone 4:** Confidence-Aware Cyber-Risk Scoring & SHA-256 Tamper-Evident Audit Trail.
