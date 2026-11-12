# ChainSentry 🛡️🔍
### Confidence-Aware Blockchain Forensics, Transaction Flow Intelligence & Adversarial Detection

> **Status:** Full-Stack Forensic System Implemented & Tested
> **Backend:** Python + FastAPI + NetworkX + PyVis + Multi-Source Ingestion (`server/`)
> **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (`client/`)
> **Package Managers:** `uv` (Python), `npm` (Node.js)
> **Repository Layout:** Clean Monorepo (`server/`, `client/`, `docs/`, `Makefile`)

---

## 1. What Has Been Implemented

ChainSentry provides an end-to-end forensic intelligence pipeline to reconstruct multi-hop transaction networks, track illicit fund movements, and detect adversarial manipulations (dusting attacks, address poisoning):

### 1. Frontend Client Dashboard (`client/`):
- **Horizontal Connection Flow Pipeline:** Interactive SVG-based visual flow chart matching forensic intelligence standards:
  - 🔴 **Illicit Source:** Origin person/vault with pulsing warning glow.
  - 🔵 **Horizontal Main Trunk:** Transit wallets (`1peelt...et01`, `1peelt...et02`) connected by thick cyan directional arrows with transfer amount badges directly on the path.
  - ↗️ **Curved Peel Arches:** Smooth Bezier curves arching upward to secondary transit/merchant wallets with peel amount badges.
  - 🏛️ **Exchange Ramp:** Final cash-out exit sinks (e.g. Binance Deposit Sweeper) with exchange ramp indicators.
- **Single Address / Transaction ID Input:** Paste any Transaction ID (tx hash) or Wallet Address and hit Enter to trace.
- **Dual Currency Support:** One-click toggle and auto-detection between **Bitcoin (BTC)** and **Ethereum (ETH)**.
- **API Key & Server Integration:**
  - Automated dual-port probing (`:8000` / `:8001`) with seamless fallback.
  - Injected `X-API-Key` and `Authorization: Bearer <key>` authentication headers.
  - Settings modal for configuring backend endpoints, Etherscan API keys, and Blockstream keys.
- **Inspection Drawer:** Click any wallet node or transfer amount badge to inspect transaction hashes, addresses, and balances.

### 2. FastAPI Backend Engine (`server/`):
- **CORS Enabled:** Ready for local or remote frontend instances on any port.
- `POST /api/v1/trace`: Accepts an address or transaction ID, executes forward multi-hop BFS traversal, and returns structured graph nodes, edges, and destination sinks.
- `GET /api/v1/graph/html`: Serves the physics-based interactive PyVis graph directly in any browser or `<iframe>`.
- `GET /api/v1/benchmarks`: Provides pre-packaged ground-truth scenarios for zero-downtime evaluation.
- `GET /api/v1/health`: Operational health check.

### 3. Multi-Source Blockchain Ingestion (`server/ingestion/`):
- **Live APIs:** Blockstream Esplora API for Bitcoin and Etherscan API for Ethereum.
- **Forensic Benchmark Corpus:** Built-in deterministic test scenarios:
  - **Bitcoin Ransomware Heist:** 3-hop peel chain leading to Binance cashout, combined with an active **dusting attack** (0.00008 BTC) and **address poisoning** (0.0 BTC).
  - **Ethereum Tumbler/Mixer:** Fan-in and fan-out laundering pattern via Tornado Cash router pool.

### 4. Graph Intelligence Engine (`server/core/`):
- In-memory directed graph using **`NetworkX`** (`DiGraph`).
- Multi-hop forward **BFS path tracing** from source wallet to end receivers.
- Real-time in-degree, out-degree, total received, total sent, and balance estimations.
- Automated identification of transaction sinks (exit exchanges).

---

## 2. Project Directory Structure

```
ChainSentry/
├── Makefile                       # Unified project automation (server, client, ports)
├── README.md                      # Comprehensive project guide
├── docs/                          # Architectural and integration documentation
│   └── architecture.md
│
├── server/                        # Python Backend Engine
│   ├── main.py                    # FastAPI server entrypoint & CLI banner
│   ├── routes.py                  # API route endpoints (/trace, /benchmarks, /graph/html)
│   ├── requirements.txt           # Backend dependencies
│   ├── core/                      # NetworkX Graph engine & Pydantic models
│   │   ├── models.py              # Transaction, AddressNode, TraceResponse models
│   │   └── graph.py               # Graph builder & BFS forward-tracer
│   ├── ingestion/                 # Live APIs (Bitcoin/Ethereum) & forensic benchmarks
│   │   ├── base.py                # Abstract provider interface
│   │   ├── live_api.py            # Blockstream & Etherscan API client
│   │   └── benchmark.py           # Ground-truth test scenarios
│   ├── viz/                       # Interactive PyVis HTML renderer
│   │   └── renderer.py            # Physics network graph generator
│   ├── static/                    # Generated visual assets (trace_graph.html)
│   └── tests/                     # Automated test suite
│       └── test_pipeline.py
│
└── client/                        # Modern React Frontend Dashboard
    ├── index.html                 # App shell with dark cybersecurity styling
    ├── package.json               # Node dependencies (React 19, Lucide, Tailwind, Vite)
    ├── vite.config.ts             # Vite bundler configuration (port 5173)
    ├── tailwind.config.js         # Cyber-forensic dark theme configuration
    ├── .env.example               # Client environment variable template
    └── src/
        ├── App.tsx                # Main investigation view with clean layout
        ├── main.tsx               # Application root
        ├── index.css              # Cyber-forensic styling and glow animations
        ├── types/                 # TypeScript interfaces (TraceResponse, Transaction, etc.)
        ├── services/              # API layer with auto-port detection & key management
        │   └── api.ts
        └── components/            # UI Components
            ├── ChainFlowPipeline.tsx  # Horizontal connection pipeline matching diagram
            ├── ConnectionFlowChart.tsx# Stepped vertical flow chart
            ├── ApiKeyModal.tsx        # API Key & endpoint configuration modal
            ├── SearchBar.tsx          # Dual-mode address / tx hash search
            ├── MetricsCards.tsx       # Forensic overview counters
            ├── AdversarialAlertBanner.tsx # Dusting and poisoning alerts
            └── TransactionLedger.tsx  # Detailed transaction table
```

---

## 3. End-to-End Workflow

```
[User pastes Tx ID or Address]
            │
            ▼
┌──────────────────────────┐
│  React Client Dashboard  │ ──► Resolves Tx Hash to Person & Currency (BTC / ETH)
│  (http://localhost:5173) │
└───────────┬──────────────┘
            │ HTTP POST /api/v1/trace (Headers: X-API-Key)
            ▼
┌──────────────────────────┐
│  FastAPI Backend Server  │ ──► Auto-detected on Port 8000 (or 8001)
│  (server/main.py)        │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Ingestion Layer          │ ──► Blockstream Esplora (BTC) / Etherscan (ETH)
│ (live_api.py + corpus)   │     Fallback to forensic benchmarks on rate-limit
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ NetworkX Graph Engine    │ ──► Reconstructs directed transaction graph &
│ (server/core/graph.py)   │     executes multi-hop forward BFS path traversal
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Connection Flow Pipeline │ ──► Renders horizontal pipeline:
│ (ChainFlowPipeline.tsx)  │     Illicit Source ──► Transit Wallets ──► Exchange Ramp
└──────────────────────────┘
```

---

## 4. Quick Start & Execution (Using `Makefile`)

The project includes a comprehensive [Makefile](Makefile) for one-command execution:

### 1. Launch the Entire System (Backend + Client)
```bash
make dev
# or:
make run-all
```
* Concurrently starts the **FastAPI backend** (`http://localhost:8000`) and the **React client** (`http://localhost:5173`).
* Displays a live terminal dashboard showing endpoint status.
* Pressing `Ctrl+C` cleanly terminates both processes.

### 2. Inspect Active Services and Ports
```bash
make ports
```
Outputs a real-time monitor of active listening ports:
```text
┌──────────────────────────┬──────────────┬──────────────────────────────────────────────┐
│ CRYPTOTRACE ACTIVE PORTS & SERVICES MONITOR                                            │
├──────────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ SERVICE                  │ PORT / STATUS│ ENDPOINT / DETAILS                           │
├──────────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ FastAPI Backend (8000)   │ RUNNING 🟢   │ http://localhost:8000                        │
│ FastAPI Backend (8001)   │ RUNNING 🟢   │ http://localhost:8001                        │
│ Interactive API Docs     │ RUNNING 🟢   │ http://localhost:8000/docs                   │
│ PyVis Forensic Graph     │ RUNNING 🟢   │ http://localhost:8000/api/v1/graph/html      │
│ React Client UI          │ RUNNING 🟢   │ http://localhost:5173                        │
└──────────────────────────┴──────────────┴──────────────────────────────────────────────┘
```

### 3. Individual Component Controls
```bash
make client         # Start only the React client dev server (port 5173)
make client-build   # Compile client production bundle in client/dist
make server         # Start only the FastAPI backend on port 8000
make server-8001    # Start backend on alternate port 8001 (if port 8000 is occupied)
make install-all    # Install both Python uv dependencies and Node npm packages
make test           # Run automated test suite (5 passed in ~0.4s)
make test-trace     # Run sample curl trace query on hacker address
make kill-dev       # Force-kill lingering processes on ports 8000, 8001, 5173
make clean          # Clear pytest, python, and client dist caches
```

---

## 5. API Reference (`POST /api/v1/trace`)

### Request Payload
```json
{
  "target_address": "bc1q_hacker_ransomware_vault",
  "max_hops": 3,
  "currency": "BTC",
  "min_amount_threshold": 0.0,
  "generate_viz": true
}
```

### Response Payload (`200 OK`)
```json
{
  "target_address": "bc1q_hacker_ransomware_vault",
  "currency": "BTC",
  "max_hops": 3,
  "total_nodes": 9,
  "total_edges": 8,
  "execution_time_ms": 9.45,
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
  "transactions": [
    {
      "tx_hash": "tx_hop1_trunk_001",
      "from_address": "bc1q_hacker_ransomware_vault",
      "to_address": "bc1q_change_hop1",
      "amount": 47.9,
      "currency": "BTC",
      "timestamp": 1700000100,
      "fee": 0.001,
      "is_adversarial": false
    },
    {
      "tx_hash": "tx_hop1_dust_003",
      "from_address": "bc1q_hacker_ransomware_vault",
      "to_address": "bc1q_innocent_dusting_victim",
      "amount": 0.00008,
      "currency": "BTC",
      "timestamp": 1700000115,
      "fee": 0.0005,
      "is_adversarial": true,
      "adversarial_tag": "DUSTING_ATTACK"
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

---

## 6. Testing

Run the automated test suite from the project root:
```bash
make test
# or:
uv run pytest -v server/
```
All 5 automated tests pass in $\approx 0.4\text{s}$:
- `test_healthcheck`: Verifies API operational readiness.
- `test_list_benchmarks`: Verifies deterministic forensic test scenarios.
- `test_graph_construction_and_trace`: Validates NetworkX graph construction and multi-hop forward BFS path traversal to Binance.
- `test_api_trace_endpoint`: Validates the `POST /api/v1/trace` response contract.
- `test_graph_html_endpoint`: Validates PyVis interactive HTML rendering.

---

## 7. Next Milestones
- **Milestone 2:** Heuristic Engine (Automated peel-chain recognition, change-output identification, and mixer signatures).
- **Milestone 3:** Cybersecurity Defense Layer (Automated dusting filtering and look-alike address poisoning detection).
- **Milestone 4:** Confidence-Aware Cyber-Risk Scoring & SHA-256 Tamper-Evident Audit Trail.
