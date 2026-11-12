"""
Peel Chain & Change Address Asymmetry Detector for CryptoTrace.

Implements the generalized one-vs-rest asymmetry metric to identify whether
a transaction is peeling off small expenses while sending the bulk of funds
to a newly generated change address.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from core.logger import get_logger

logger = get_logger(__name__)


class PeelChainResult(BaseModel):
    """Structured forensic verdict for a peel chain evaluation."""
    is_peel_chain: bool = Field(..., description="True if transaction matches peel chain asymmetry")
    asymmetry_metric: float = Field(..., description="Calculated Delta Peel asymmetry in [-1.0, 1.0]")
    trunk_wallet: Optional[str] = Field(None, description="Address holding the unspent change (trunk)")
    peeled_wallets: List[str] = Field(default_factory=list, description="Addresses receiving peeled expenses")
    total_volume: float = Field(default=0.0, description="Total transacted volume evaluated")
    trunk_share: float = Field(default=0.0, description="Fraction of volume held by the trunk output")


def detect_peel_chain(outputs: List[Dict[str, Any]], threshold: float = 0.85) -> PeelChainResult:
    """
    Evaluates generalized peel chain asymmetry across 2 or more outputs.

    Formula:
        v_max = max(outputs)
        V_peeled = sum(outputs) - v_max
        Delta_peel = (v_max - V_peeled) / (v_max + V_peeled)

    Condition:
        is_peel_chain <=> Delta_peel >= threshold (default 0.85)

    Args:
        outputs: List of dicts, each containing:
                 - 'address': str (recipient address)
                 - 'value': float or int (amount in BTC or satoshis)
        threshold: Asymmetry cutoff (default 0.85).

    Returns:
        PeelChainResult containing boolean verdict, metric, trunk, and peeled wallets.
    """
    if not outputs or len(outputs) < 2:
        return PeelChainResult(
            is_peel_chain=False,
            asymmetry_metric=0.0,
            trunk_wallet=None,
            peeled_wallets=[],
            total_volume=0.0,
            trunk_share=0.0,
        )

    # Filter and extract valid non-negative outputs
    valid_outputs = [
        {"address": str(out.get("address", "")), "value": float(out.get("value", 0.0))}
        for out in outputs
        if float(out.get("value", 0.0)) > 0.0
    ]

    if len(valid_outputs) < 2:
        return PeelChainResult(
            is_peel_chain=False,
            asymmetry_metric=0.0,
            trunk_wallet=None,
            peeled_wallets=[],
            total_volume=sum(out["value"] for out in valid_outputs),
            trunk_share=1.0 if valid_outputs else 0.0,
        )

    # Sort descending by value
    sorted_outs = sorted(valid_outputs, key=lambda x: x["value"], reverse=True)
    v_max_node = sorted_outs[0]
    v_max = v_max_node["value"]

    v_peeled_nodes = sorted_outs[1:]
    v_peeled_sum = sum(out["value"] for out in v_peeled_nodes)

    total = v_max + v_peeled_sum
    if total <= 0.0:
        return PeelChainResult(
            is_peel_chain=False,
            asymmetry_metric=0.0,
            trunk_wallet=None,
            peeled_wallets=[],
            total_volume=0.0,
            trunk_share=0.0,
        )

    # Calculate generalized Delta Peel: (v_max - V_peeled) / total
    delta_peel = (v_max - v_peeled_sum) / total
    is_peel = delta_peel >= threshold

    trunk_share = v_max / total

    if is_peel:
        logger.debug(
            "Peel chain detected: trunk=%s (share=%.1f%%, delta=%.4f)",
            v_max_node["address"],
            trunk_share * 100,
            delta_peel,
        )

    return PeelChainResult(
        is_peel_chain=is_peel,
        asymmetry_metric=round(delta_peel, 4),
        trunk_wallet=v_max_node["address"] if is_peel else None,
        peeled_wallets=[out["address"] for out in v_peeled_nodes] if is_peel else [],
        total_volume=round(total, 8),
        trunk_share=round(trunk_share, 4),
    )
