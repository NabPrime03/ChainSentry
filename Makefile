.DEFAULT_GOAL := help

.PHONY: help install run server client test test-trace dev run-all ports kill-port kill-dev clean

PYTHON ?= python3
UV ?= uv

help: ## Show this help message with available project controls
	@echo "CryptoTrace — Confidence-Aware Blockchain Forensics & Threat Detection"
	@echo "======================================================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Set up Python virtual environment and install backend dependencies via uv
	@echo "Installing backend Python dependencies via uv..."
	@$(UV) venv
	@$(UV) pip install -r server/requirements.txt
	@echo "[✓] All dependencies successfully installed!"

run: server ## Start FastAPI backend server directly (port 8000)

server: ## Launch FastAPI backend server directly (port 8000)
	@cd server && $(UV) run uvicorn main:app --reload --host 0.0.0.0 --port 8000

client: ## Start React / Next.js client dev server if client/package.json exists
	@if [ -f "client/package.json" ]; then \
		cd client && npm run dev; \
	else \
		echo "[i] client/package.json not found. Reserved for frontend team."; \
	fi

dev: ## Launch backend server and display full service endpoints dashboard
	@python3 -c "\
c_c = '\033[1;36m'; c_r = '\033[0m'; c_g = '\033[1;32m'; c_y = '\033[1;33m'; c_b = '\033[1;34m'; c_w = '\033[1m'; \
w1, w2, w3 = 24, 12, 44; \
header = 'CRYPTOTRACE FORENSIC INTELLIGENCE — SYSTEM DASHBOARD'; \
total_inner = (w1 + 2) + 1 + (w2 + 2) + 1 + (w3 + 2); \
padding = total_inner - len(header) - 1; \
print(); \
print(f'{c_c}┌{\"─\"*(w1+2)}┬{\"─\"*(w2+2)}┬{\"─\"*(w3+2)}┐{c_r}'); \
print(f'{c_c}│{c_r} {c_w}{header}{c_r}{\" \" * padding}{c_c}│{c_r}'); \
print(f'{c_c}├{\"─\"*(w1+2)}┼{\"─\"*(w2+2)}┼{\"─\"*(w3+2)}┤{c_r}'); \
print(f'{c_c}│{c_r} {c_w}{\"SERVICE\":<{w1}}{c_r} │ {c_w}{\"STATUS\":<{w2}}{c_r} │ {c_w}{\"ENDPOINT / DETAILS\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}├{\"─\"*(w1+2)}┼{\"─\"*(w2+2)}┼{\"─\"*(w3+2)}┤{c_r}'); \
print(f'{c_c}│{c_r} {\"FastAPI Backend\":<{w1}} │ {c_g}{\"STARTING\":<{w2}}{c_r} │ {c_b}{\"http://localhost:8000\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}│{c_r} {\"Interactive API Docs\":<{w1}} │ {c_g}{\"READY\":<{w2}}{c_r} │ {c_b}{\"http://localhost:8000/docs\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}│{c_r} {\"PyVis Forensic Graph\":<{w1}} │ {c_g}{\"READY\":<{w2}}{c_r} │ {c_b}{\"http://localhost:8000/api/v1/graph/html\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}│{c_r} {\"Forensic Benchmarks\":<{w1}} │ {c_g}{\"READY\":<{w2}}{c_r} │ {c_b}{\"http://localhost:8000/api/v1/benchmarks\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}│{c_r} {\"React Frontend UI\":<{w1}} │ {c_y}{\"CLIENT WS\":<{w2}}{c_r} │ {c_b}{\"http://localhost:3000\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}└{\"─\"*(w1+2)}┴{\"─\"*(w2+2)}┴{\"─\"*(w3+2)}┘{c_r}'); \
print('   \033[90m* Press Ctrl+C to stop Backend and background servers.\033[0m\n'); \
"
	@bash -c "trap 'kill 0' SIGINT SIGTERM EXIT; (cd server && $(UV) run uvicorn main:app --reload --host 0.0.0.0 --port 8000) & wait"

run-all: dev ## Alias for dev

test: ## Run complete automated test suite (ingestion, graph, API)
	@$(UV) run pytest -v server/

test-trace: ## Send sample trace request on hacker address via curl
	@echo "Querying CryptoTrace API on http://localhost:8000/api/v1/trace..."
	@curl -s -X POST "http://localhost:8000/api/v1/trace" \
		-H "Content-Type: application/json" \
		-d '{"target_address": "bc1q_hacker_ransomware_vault", "max_hops": 3}' | python3 -m json.tool

ports: ## Inspect currently active services and listening network ports
	@python3 -c "\
c_c = '\033[1;36m'; c_r = '\033[0m'; c_g = '\033[1;32m'; c_m = '\033[90m'; c_b = '\033[1;34m'; c_w = '\033[1m'; \
w1, w2, w3 = 24, 12, 44; \
header = 'CRYPTOTRACE ACTIVE PORTS & SERVICES MONITOR'; \
total_inner = (w1 + 2) + 1 + (w2 + 2) + 1 + (w3 + 2); \
padding = total_inner - len(header) - 1; \
chk = lambda p: (lambda s: (s.settimeout(0.2), s.connect_ex(('127.0.0.1', p)) == 0, s.close())[1])(__import__('socket').socket()); \
s8000 = f'{c_g}RUNNING 🟢{c_r}' if chk(8000) else f'{c_m}STOPPED ⚪{c_r}'; \
s3000 = f'{c_g}RUNNING 🟢{c_r}' if chk(3000) else f'{c_m}STOPPED ⚪{c_r}'; \
print(); \
print(f'{c_c}┌{\"─\"*(w1+2)}┬{\"─\"*(w2+2)}┬{\"─\"*(w3+2)}┐{c_r}'); \
print(f'{c_c}│{c_r} {c_w}{header}{c_r}{\" \" * padding}{c_c}│{c_r}'); \
print(f'{c_c}├{\"─\"*(w1+2)}┼{\"─\"*(w2+2)}┼{\"─\"*(w3+2)}┤{c_r}'); \
print(f'{c_c}│{c_r} {c_w}{\"SERVICE\":<{w1}}{c_r} │ {c_w}{\"PORT / STATUS\":<{w2}}{c_r} │ {c_w}{\"ENDPOINT / DETAILS\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}├{\"─\"*(w1+2)}┼{\"─\"*(w2+2)}┼{\"─\"*(w3+2)}┤{c_r}'); \
print(f'{c_c}│{c_r} {\"FastAPI Backend\":<{w1}} │ {s8000:<{w2+9}} │ {c_b}{\"http://localhost:8000\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}│{c_r} {\"Interactive API Docs\":<{w1}} │ {s8000:<{w2+9}} │ {c_b}{\"http://localhost:8000/docs\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}│{c_r} {\"PyVis Forensic Graph\":<{w1}} │ {s8000:<{w2+9}} │ {c_b}{\"http://localhost:8000/api/v1/graph/html\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}│{c_r} {\"React Frontend UI\":<{w1}} │ {s3000:<{w2+9}} │ {c_b}{\"http://localhost:3000\":<{w3}}{c_r} {c_c}│{c_r}'); \
print(f'{c_c}└{\"─\"*(w1+2)}┴{\"─\"*(w2+2)}┴{\"─\"*(w3+2)}┘{c_r}'); \
"

kill-port: ## Force-kill process on specific port (e.g. make kill-port PORT=8000)
	@if [ -n "$(PORT)" ]; then \
		PIDS=$$(lsof -ti :$(PORT) 2>/dev/null); \
		if [ -n "$$PIDS" ]; then \
			kill -9 $$PIDS 2>/dev/null && echo "[✓] Killed process(es) on port $(PORT): $$PIDS"; \
		else \
			echo "[i] Port $(PORT) is already free."; \
		fi \
	else \
		echo "Usage: make kill-port PORT=<number> (e.g. make kill-port PORT=8000)"; \
	fi

kill-dev: ## Force-kill lingering processes on ports 8000 (FastAPI) and 3000 (React)
	@for p in 8000 3000; do \
		PIDS=$$(lsof -ti :$$p 2>/dev/null); \
		if [ -n "$$PIDS" ]; then \
			kill -9 $$PIDS 2>/dev/null && echo "[✓] Cleared port $$p (PID: $$PIDS)"; \
		fi \
	done; \
	echo "[✓] Ports 8000 and 3000 checked and clear."

clean: ## Remove .pytest_cache, __pycache__, and temporary files
	@rm -rf .pytest_cache .mypy_cache server/.pytest_cache
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@find . -type f -name "*.pyc" -delete
	@rm -rf server/static/*.tmp server/lib lib
	@echo "[✓] Cleaned all cache and temporary files."
