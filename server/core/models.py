"""
Data models for CryptoTrace transaction graph and analysis.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Transaction(BaseModel):
    """Represents a validated financial transaction edge between two addresses."""
    tx_hash: str = Field(..., description="Unique transaction hash or identifier")
    from_address: str = Field(..., description="Sender wallet address")
    to_address: str = Field(..., description="Recipient wallet address")
    amount: float = Field(..., ge=0.0, description="Transaction value in crypto denomination")
    currency: str = Field(default="BTC", description="Cryptocurrency symbol (BTC, ETH, etc.)")
    timestamp: int = Field(..., description="Unix epoch timestamp of block or transaction")
    fee: float = Field(default=0.0, ge=0.0, description="Miner or network gas fee")
    block_number: Optional[int] = Field(default=None, description="Block height if confirmed")
    is_adversarial: bool = Field(default=False, description="Flagged as adversarial decoy or dust")
    adversarial_tag: Optional[str] = Field(default=None, description="Type of adversarial event (DUST, POISONING)")


class AddressNode(BaseModel):
    """Represents a wallet address node within the transaction graph."""
    address: str
    in_degree: int = 0
    out_degree: int = 0
    total_received: float = 0.0
    total_sent: float = 0.0
    balance_estimate: float = 0.0
    tags: List[str] = Field(default_factory=list)
    is_source: bool = False
    hop_distance: Optional[int] = None


class TraceRequest(BaseModel):
    """User/Frontend request payload to initiate a forensic trace."""
    target_address: str = Field(..., description="The suspicious source address to trace from")
    max_hops: int = Field(default=3, ge=1, le=10, description="Maximum forward traversal depth")
    currency: str = Field(default="BTC", description="Target currency (BTC, ETH)")
    min_amount_threshold: float = Field(default=0.0, ge=0.0, description="Minimum transfer amount to expand")
    generate_viz: bool = Field(default=True, description="Whether to compile PyVis interactive HTML")


class EndReceiverSummary(BaseModel):
    """Summarizes a discovered destination wallet reached during multi-hop tracing."""
    address: str
    hop_depth: int
    amount_reached: float
    path: List[str]
    tags: List[str] = Field(default_factory=list)
    is_sink: bool = False


class TraceResponse(BaseModel):
    """Structured response returned by the trace API."""
    target_address: str
    currency: str
    max_hops: int
    total_nodes: int
    total_edges: int
    nodes: List[AddressNode]
    transactions: List[Transaction]
    end_receivers: List[EndReceiverSummary]
    viz_html_available: bool = False
    viz_html_path: Optional[str] = None
    execution_time_ms: float
