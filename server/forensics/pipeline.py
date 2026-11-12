"""
Forensic Analysis Pipeline & Multi-Pattern Risk Orchestrator for CryptoTrace.

Coordinates execution across individual forensic detector functions and produces
a clean, streamlined report showing each function's risk score and 1-2 line reason,
along with an overall composite risk score and Bayesian confidence rating.
"""
import math
from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field
from core.logger import get_logger
from core.models import Transaction, AddressNode, EndReceiverSummary
from core.entities import identify_entity
from forensics.peel_chain import detect_peel_chain, PeelChainResult

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Streamlined Pydantic Schemas
# ---------------------------------------------------------------------------

class FunctionRisk(BaseModel):
    """Direct, single-function risk result with 1-2 line reason."""
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Risk points contributed (0-100)")
    status: str = Field(..., description="FLAGGED, SUSPICIOUS, or CLEAN")
    reason: str = Field(..., description="1-2 line clear forensic reason and evidence")


class OverallRisk(BaseModel):
    """High-level aggregated threat assessment."""
    score: float = Field(..., ge=0.0, le=100.0, description="Total composite risk score bounded in [0, 100]")
    level: str = Field(..., description="CRITICAL, HIGH, MEDIUM, or LOW")
    confidence_score: float = Field(default=100.0, ge=0.0, le=100.0, description="Bayesian certainty rating (0-100%)")
    confidence_level: str = Field(default="HIGH", description="HIGH, MEDIUM, or LOW")
    summary: str = Field(..., description="1-2 line overall forensic verdict and findings")


class ForensicReport(BaseModel):
    """Complete, clean forensic dossier returned to API and UI."""
    target_address: str
    hops_analyzed: int
    overall_risk: OverallRisk
    function_risks: Dict[str, FunctionRisk]


# ---------------------------------------------------------------------------
# Bayesian Confidence Scorer (Formula 2 from Mathematical Specs)
# ---------------------------------------------------------------------------

def calculate_bayesian_confidence(
    tx_count: int,
    total_volume: float,
    lambda_n: float = 0.15,
    lambda_v: float = 0.25,
) -> tuple[float, str]:
    """
    Bayesian Evidence Saturation formula:
        C(N, V) = (1 - e^(-lambda_n * N)) * (1 - e^(-lambda_v * V))
    Calculates epistemic certainty based on transaction history and transacted volume.
    """
    c_n = 1.0 - math.exp(-lambda_n * max(0, tx_count))
    c_v = 1.0 - math.exp(-lambda_v * max(0.0, total_volume))
    confidence_pct = round((c_n * c_v) * 100.0, 1)

    if confidence_pct >= 70.0:
        level = "HIGH"
    elif confidence_pct >= 35.0:
        level = "MEDIUM"
    else:
        level = "LOW"
    return confidence_pct, level


# ---------------------------------------------------------------------------
# Individual Sub-Evaluators
# ---------------------------------------------------------------------------

def evaluate_peel_chain(
    target_address: str,
    transactions: List[Transaction],
) -> FunctionRisk:
    """Evaluates transactions across the trace to detect peel chain laundering patterns."""
    if not transactions:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="No outgoing transactions available to evaluate for peel chains.",
        )

    # Group outputs by individual transaction hash to evaluate each split independently
    tx_by_hash: Dict[str, Dict[str, Any]] = {}
    for tx in transactions:
        tx_by_hash.setdefault(tx.tx_hash, {"from": tx.from_address, "outputs": []})
        tx_by_hash[tx.tx_hash]["outputs"].append({"address": tx.to_address, "value": tx.amount})

    peel_txs: List[Dict[str, Any]] = []
    peel_by_sender: Dict[str, List[Dict[str, Any]]] = {}

    for tx_hash, info in tx_by_hash.items():
        if len(info["outputs"]) >= 2:
            res: PeelChainResult = detect_peel_chain(info["outputs"])
            if res.is_peel_chain and res.trunk_wallet:
                peel_entry = {
                    "tx_hash": tx_hash,
                    "from": info["from"],
                    "trunk": res.trunk_wallet,
                    "asymmetry": res.asymmetry_metric,
                    "peeled_vol": res.total_volume * (1.0 - res.trunk_share),
                    "total_vol": res.total_volume,
                }
                peel_txs.append(peel_entry)
                peel_by_sender.setdefault(info["from"], []).append(peel_entry)

    # Trace consecutive hops starting from target_address down trunk wallets
    consecutive_hops = 0
    total_peeled_amount = 0.0
    current_addr = target_address
    visited = set()
    last_trunk = None

    while current_addr in peel_by_sender and current_addr not in visited:
        visited.add(current_addr)
        peels = peel_by_sender[current_addr]
        best_peel = max(peels, key=lambda p: p["total_vol"])
        consecutive_hops += 1
        total_peeled_amount += best_peel["peeled_vol"]
        last_trunk = best_peel["trunk"]
        current_addr = best_peel["trunk"]

    total_peel_count = len(peel_txs)

    if consecutive_hops >= 2:
        risk = min(35.0, 20.0 + (consecutive_hops * 5.0))
        trunk_label = f" along trunk {last_trunk[:10]}..." if last_trunk else ""
        return FunctionRisk(
            risk_score=risk,
            status="FLAGGED",
            reason=f"{consecutive_hops} consecutive peel hops detected{trunk_label}; {round(total_peeled_amount, 4)} volume peeled off while bulk remained on trunk.",
        )
    elif consecutive_hops == 1 or total_peel_count >= 1:
        risk = 25.0 if total_peel_count >= 2 else 15.0
        status = "FLAGGED" if total_peel_count >= 2 else "SUSPICIOUS"
        return FunctionRisk(
            risk_score=risk,
            status=status,
            reason=f"{total_peel_count} peel-off transaction(s) detected; asymmetric change splits routing funds to satellite wallets.",
        )
    else:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="No peel chain asymmetry detected across outgoing transfers.",
        )


def evaluate_terminal_sinks(
    end_receivers: List[EndReceiverSummary],
) -> FunctionRisk:
    """Evaluates discovered terminal destinations (exchanges, mixers, dormant sinks)."""
    if not end_receivers:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="No terminal destination wallets identified in the trace.",
        )

    mixer_hits = []
    exchange_hits = []

    for sink in end_receivers:
        cat, name, is_exchange, is_mixer = identify_entity(sink.address)
        label = name or sink.address[:10] + "..."
        if is_mixer or sink.is_mixer:
            mixer_hits.append(label)
        elif is_exchange or sink.is_terminal_cashout:
            exchange_hits.append(label)

    if mixer_hits:
        names = ", ".join(mixer_hits[:2])
        return FunctionRisk(
            risk_score=45.0,
            status="FLAGGED",
            reason=f"Funds route into privacy mixer/tumbler: {names}.",
        )
    elif exchange_hits:
        names = ", ".join(exchange_hits[:2])
        return FunctionRisk(
            risk_score=25.0,
            status="FLAGGED",
            reason=f"Funds terminate at centralized exchange cash-out deposit point: {names}.",
        )
    else:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason=f"All {len(end_receivers)} terminal destinations remain in unspent cold storage or dormant wallets.",
        )


def evaluate_sanctions_attribution(
    nodes: List[AddressNode],
) -> FunctionRisk:
    """Evaluates whether any traversed address matches OFAC, ransomware, or sanction lists."""
    direct_hit_name = None
    highest_risk = 0.0
    highest_entity_name = None
    highest_hop = 0

    for node in nodes:
        cat, name, _, _ = identify_entity(node.address)
        if cat == "SANCTIONED":
            hop = node.hop_distance if node.hop_distance is not None else 1
            decay = 0.5 ** hop
            score = 100.0 * decay
            if hop == 0 or node.is_source:
                direct_hit_name = name or node.address
                highest_risk = 100.0
                break
            if score > highest_risk:
                highest_risk = score
                highest_entity_name = name or node.address
                highest_hop = hop

    if direct_hit_name:
        return FunctionRisk(
            risk_score=100.0,
            status="FLAGGED",
            reason=f"Target address is directly registered on OFAC/sanction list: {direct_hit_name}.",
        )
    elif highest_risk > 0.0:
        return FunctionRisk(
            risk_score=round(min(50.0, highest_risk), 1),
            status="FLAGGED",
            reason=f"Indirect exposure to sanctioned entity ({highest_entity_name}) at hop distance {highest_hop} (decayed risk: {round(highest_risk, 1)}).",
        )
    else:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="No OFAC, ransomware, or sanctioned addresses detected in graph.",
        )


def evaluate_dusting_attack(
    target_address: str,
    transactions: List[Transaction],
) -> FunctionRisk:
    """
    Evaluates whether the target address has received unsolicited micro-dust transactions.
    Standard Bitcoin dust limits are 546 satoshis (0.00000546 BTC) for P2PKH and
    330-332 satoshis for SegWit/Taproot.
    """
    inflows = [
        tx for tx in transactions
        if tx.to_address == target_address and tx.from_address != target_address
    ]
    if not inflows:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="No incoming transactions available to evaluate for dusting.",
        )

    dust_txs = [tx for tx in inflows if tx.amount <= 0.0001]
    dust_count = len(dust_txs)
    total_inflows = len(inflows)
    dust_ratio = dust_count / total_inflows
    unique_senders = len(set(tx.from_address for tx in dust_txs))

    if dust_count >= 5 or (dust_count >= 2 and dust_ratio >= 0.5):
        risk = 40.0
        return FunctionRisk(
            risk_score=risk,
            status="FLAGGED",
            reason=f"Active dusting attack detected: {dust_count}/{total_inflows} inflows ({round(dust_ratio * 100, 1)}%) are micro-dust amounts (e.g. 546/332 satoshis) from {unique_senders} distinct senders.",
        )
    elif dust_count >= 1:
        return FunctionRisk(
            risk_score=15.0,
            status="SUSPICIOUS",
            reason=f"Potential dusting probe: {dust_count} incoming micro-transaction ({round(dust_txs[0].amount, 8)} BTC) detected.",
        )
    else:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="No unsolicited micro-dust or tracking probe transactions detected in inflows.",
        )


def evaluate_mining_origin(
    target_address: str,
    transactions: List[Transaction],
) -> FunctionRisk:
    """Classifies whether incoming funds originate from newly minted Proof-of-Work block rewards (Coinbase)."""
    mining_txs = [
        tx for tx in transactions
        if tx.to_address == target_address and "coinbase (mining reward)" in tx.from_address.lower()
    ]
    if not mining_txs:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="No newly minted Coinbase block rewards detected in inflows.",
        )

    total_mined = sum(tx.amount for tx in mining_txs)
    return FunctionRisk(
        risk_score=0.0,
        status="CLEAN",
        reason=f"Verified Proof-of-Work Mining Entity: {len(mining_txs)} newly minted block rewards received ({round(total_mined, 4)} BTC total).",
    )


def evaluate_address_poisoning(
    target_address: str,
    transactions: List[Transaction],
    nodes: List[AddressNode],
) -> FunctionRisk:
    """
    Detects address poisoning attacks: checks for vanity look-alike senders matching
    the first 4 and last 4 characters of genuine interacting addresses with 0-value or dust amounts.
    """
    # 1. Check explicit adversarial flags
    for tx in transactions:
        if tx.adversarial_tag == "ADDRESS_POISONING" or "poison" in (tx.adversarial_tag or "").lower():
            return FunctionRisk(
                risk_score=35.0,
                status="FLAGGED",
                reason=f"Address poisoning spoofing attack detected: Decoy transfer ({tx.tx_hash[:10]}...) spoofing look-alike vanity address.",
            )

    # 2. Check prefix-suffix vanity matches among interaction addresses
    all_addresses = list(set([n.address for n in nodes] + [target_address]))
    for tx in transactions:
        if tx.to_address == target_address and (tx.amount == 0.0 or tx.amount <= 1e-4):
            sender = tx.from_address
            if len(sender) >= 8:
                for genuine in all_addresses:
                    if genuine != sender and len(genuine) >= 8:
                        prefix_match = sender[:4].lower() == genuine[:4].lower()
                        suffix_match = sender[-4:].lower() == genuine[-4:].lower()
                        if prefix_match and suffix_match:
                            return FunctionRisk(
                                risk_score=35.0,
                                status="FLAGGED",
                                reason=f"Address poisoning detected: Vanity look-alike address ({sender[:6]}...{sender[-4:]}) matches genuine address ({genuine[:6]}...{genuine[-4:]}) with sub-economic transfer.",
                            )

    return FunctionRisk(
        risk_score=0.0,
        status="CLEAN",
        reason="No zero-value vanity address poisoning or look-alike decoys detected.",
    )


def evaluate_mixer_entropy(
    transactions: List[Transaction],
) -> FunctionRisk:
    """
    Detects privacy mixer/tumbler pools (e.g., Wasabi, Tornado Cash) using Normalized
    Shannon Information Entropy across transaction output amounts:
        H(X) = - sum(p_i * log2(p_i)),   E_norm = H(X) / log2(k)
    When E_norm >= 0.92 and k >= 4, outputs represent uniform equal-sized anonymity pools.
    """
    tx_outputs: Dict[str, List[float]] = {}
    for tx in transactions:
        tx_outputs.setdefault(tx.tx_hash, []).append(tx.amount)

    highest_entropy = 0.0
    output_count = 0

    for tx_hash, amounts in tx_outputs.items():
        k = len(amounts)
        if k >= 3:
            total_vol = sum(amounts)
            if total_vol > 0:
                probs = [amt / total_vol for amt in amounts if amt > 0]
                if len(probs) >= 3:
                    h = -sum(p * math.log2(p) for p in probs)
                    max_h = math.log2(len(probs))
                    if max_h > 0:
                        e_norm = h / max_h
                        if e_norm > highest_entropy:
                            highest_entropy = e_norm
                            output_count = len(probs)

    if highest_entropy >= 0.92 and output_count >= 4:
        return FunctionRisk(
            risk_score=45.0,
            status="FLAGGED",
            reason=f"Equal-denomination mixer pool detected: Shannon entropy of {round(highest_entropy, 3)} across {output_count} uniform outputs matching CoinJoin anonymity set.",
        )
    elif highest_entropy >= 0.85 and output_count >= 3:
        return FunctionRisk(
            risk_score=20.0,
            status="SUSPICIOUS",
            reason=f"Potential mixing activity: High output entropy ({round(highest_entropy, 3)}) across {output_count} balanced outputs.",
        )
    else:
        return FunctionRisk(
            risk_score=0.0,
            status="CLEAN",
            reason="Output distributions show normal economic variance; no equal-denomination mixing entropy detected.",
        )


def evaluate_cluster_recombination(
    transactions: List[Transaction],
    nodes: List[AddressNode],
) -> FunctionRisk:
    """
    Detects Common-Input Ownership Clustering & Mule Recombination:
    Flags when multiple micro-mule addresses co-spend their inputs together in a single
    transaction (Common-Input Ownership Heuristic).
    """
    senders_by_tx: Dict[str, Set[str]] = {}
    for tx in transactions:
        senders_by_tx.setdefault(tx.tx_hash, set()).add(tx.from_address)

    for tx_hash, senders in senders_by_tx.items():
        if len(senders) >= 3:
            return FunctionRisk(
                risk_score=25.0,
                status="FLAGGED",
                reason=f"Common-input mule recombination detected: {len(senders)} distinct wallets co-spent inputs in single transaction ({tx_hash[:10]}...).",
            )

    return FunctionRisk(
        risk_score=0.0,
        status="CLEAN",
        reason="No multi-input common ownership clustering or co-spend recombination detected.",
    )


# ---------------------------------------------------------------------------
# Master Pipeline Orchestrator
# ---------------------------------------------------------------------------

class ForensicPipeline:
    """
    Master pipeline orchestrating all forensic analysis detectors on an investigated address.
    """

    def analyze(
        self,
        target_address: str,
        nodes: List[AddressNode],
        transactions: List[Transaction],
        end_receivers: List[EndReceiverSummary],
        max_hops: int,
    ) -> ForensicReport:
        """
        Coordinates execution across all 8 forensic detectors and synthesizes an explainable dossier.
        """
        logger.info("Executing ForensicPipeline for %s (hops: %d)", target_address, max_hops)

        # 1. Run each detector module
        peel_result = evaluate_peel_chain(target_address, transactions)
        sink_result = evaluate_terminal_sinks(end_receivers)
        sanction_result = evaluate_sanctions_attribution(nodes)
        dust_result = evaluate_dusting_attack(target_address, transactions)
        mining_result = evaluate_mining_origin(target_address, transactions)
        poison_result = evaluate_address_poisoning(target_address, transactions, nodes)
        entropy_result = evaluate_mixer_entropy(transactions)
        cluster_result = evaluate_cluster_recombination(transactions, nodes)

        function_risks: Dict[str, FunctionRisk] = {
            "peel_chain": peel_result,
            "terminal_sink": sink_result,
            "sanctions": sanction_result,
            "dusting_attack": dust_result,
            "address_poisoning": poison_result,
            "mixer_entropy": entropy_result,
            "cluster_recombination": cluster_result,
            "mining_origin": mining_result,
        }

        # 2. Check entity registry for verified benign / non-profit entities
        cat, entity_name, _, _ = identify_entity(target_address)
        is_verified_benign = (cat == "BENIGN")

        # 3. Calculate composite threat score
        # Separate active malicious laundering from passive victimhood (e.g. unsolicited dust/poisoning)
        active_malicious_score = (
            sanction_result.risk_score
            + peel_result.risk_score
            + sink_result.risk_score
            + entropy_result.risk_score
            + cluster_result.risk_score
        )

        # Passive targeting exposure (unsolicited incoming dust or look-alike attempts where address is a target/victim)
        passive_targeting_score = (dust_result.risk_score + poison_result.risk_score) * 0.25

        if is_verified_benign:
            threat_score = 0.0
            risk_level = "LOW"
        elif active_malicious_score == 0.0:
            # Address has no active laundering; incoming dust/poisoning is purely victim exposure
            threat_score = min(15.0, passive_targeting_score)
            risk_level = "LOW"
        else:
            raw_score = active_malicious_score + passive_targeting_score
            threat_score = min(100.0, max(0.0, raw_score))
            if threat_score >= 75.0:
                risk_level = "CRITICAL"
            elif threat_score >= 50.0:
                risk_level = "HIGH"
            elif threat_score >= 25.0:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

        # 4. Calculate Bayesian Evidence Saturation Confidence
        total_vol = sum(tx.amount for tx in transactions)
        confidence_pct, confidence_level = calculate_bayesian_confidence(
            tx_count=len(transactions),
            total_volume=total_vol,
        )

        # 5. Synthesize 1-2 line summary of what was detected
        active_reasons = [det.reason for det in function_risks.values() if det.status in ["FLAGGED", "SUSPICIOUS"]]
        if is_verified_benign:
            summary = f"Verified Benign Entity: {entity_name}. Recognized non-profit / public infrastructure with 0 malicious threat."
        elif not active_reasons:
            summary = "No anomalous layering, peel chains, or illicit destinations detected across investigated hops."
        else:
            summary = " ".join(active_reasons)

        overall = OverallRisk(
            score=round(threat_score, 1),
            level=risk_level,
            confidence_score=confidence_pct,
            confidence_level=confidence_level,
            summary=summary,
        )

        return ForensicReport(
            target_address=target_address,
            hops_analyzed=max_hops,
            overall_risk=overall,
            function_risks=function_risks,
        )
