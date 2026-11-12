"""
CryptoTrace Server Entrypoint & Application Factory.
Provides the FastAPI app, middleware, routes, and local dev runner.

Run with: uv run python main.py
"""
import os
import sys
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from core.logger import configure_logging, get_logger

configure_logging()
logger = get_logger("cryptotrace")

try:
    from routes import router
except ImportError:
    from server.routes import router


def create_app() -> FastAPI:
    """Builds and configures the FastAPI application instance."""
    logger.info("Building CryptoTrace FastAPI application factory...")
    app = FastAPI(
        title="CryptoTrace Forensic Intelligence API",
        description=(
            "Security-oriented blockchain forensic intelligence backend. "
            "Reconstructs multi-hop transaction graphs, detects adversarial manipulation "
            "(dusting, address poisoning), and traces fund flows."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Enable CORS for frontend integration (React, Next.js, Vue, etc.)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Ensure static directory exists inside server/ and mount it
    static_dir = os.path.join(SERVER_DIR, "static")
    os.makedirs(static_dir, exist_ok=True)
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    # Include routes
    app.include_router(router)

    return app


app = create_app()

if __name__ == "__main__":
    print("==========================================================================================")
    print(" 🛡️  CryptoTrace Forensic Intelligence Backend")
    print("==========================================================================================")
    print("┌──────────────────────┬──────────┬──────────────────────────────────────────────────────┐")
    print("│ Service / Endpoint   │ Port     │ URL                                                  │")
    print("├──────────────────────┼──────────┼──────────────────────────────────────────────────────┤")
    print("│ API Root & Health    │ 8000     │ http://localhost:8000/api/v1/health                  │")
    print("│ Swagger Docs (OpenAPI│ 8000     │ http://localhost:8000/docs                           │")
    print("│ Interactive Graph    │ 8000     │ http://localhost:8000/api/v1/graph/html             │")
    print("│ Benchmarks List      │ 8000     │ http://localhost:8000/api/v1/benchmarks              │")
    print("└──────────────────────┴──────────┴──────────────────────────────────────────────────────┘")
    print("==========================================================================================")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
