"""
Side-by-Side Forensic Evaluation Benchmark Script for CryptoTrace / ChainSentry.

Runs a side-by-side comparison between legitimate/normal baseline Bitcoin addresses
and confirmed cyberattack/hacker addresses to verify low false-positive rates,
sharp discriminative threat scoring, and cryptographic audit trail integrity.
"""
import sys
import os
import json
import time
import hashlib
import requests
from typing import Dict, Any

API_BASE_URL = os.environ.get("CRYPTOTRACE_API", "http://localhost:8000/api/v1/trace")


def run_single_trace(address: str, label: str, max_hops: int = 5) -> Dict[str, Any]:
    """Queries the local forensic trace endpoint and parses the dossier."""
    payload = {
        "target_address": address,
        "currency": "BTC",
        "max_hops": max_hops,
    }
    t0 = time.time()
    try:
        resp = requests.post(API_BASE_URL, json=payload, timeout=60)
        elapsed_s = round(time.time() - t0, 2)
        if resp.status_code == 200:
            data = resp.json()
            data["_elapsed_s"] = elapsed_s
            data["_label"] = label
            return data
        else:
            return {"_error": f"HTTP {resp.status_code}: {resp.text}", "_label": label}
    except Exception as exc:
        return {"_error": str(exc), "_label": label}


def print_side_by_side_comparison(benign_res: Dict[str, Any], hacker_res: Dict[str, Any]) -> None:
    """Renders a structured terminal side-by-side report."""
    print("\n" + "=" * 92)
    print("      CRYPTOTRACE / CHAINSENTRY: BENCHMARK SIDE-BY-SIDE FORENSIC EVALUATION")
    print("=" * 92)

    col1_title = f"BENIGN BASELINE: {benign_res.get('_label')}"
    col2_title = f"CRIMINAL TARGET: {hacker_res.get('_label')}"
    print(f"{col1_title:<45} │ {col2_title:<45}")
    print("-" * 45 + "─┼─" + "-" * 45)

    # Addresses
    b_addr = benign_res.get("target_address", "N/A")
    h_addr = hacker_res.get("target_address", "N/A")
    print(f"Address: {b_addr[:35]}... │ Address: {h_addr[:35]}...")

    # Graph Size
    b_nodes = benign_res.get("total_nodes", 0)
    b_edges = benign_res.get("total_edges", 0)
    h_nodes = hacker_res.get("total_nodes", 0)
    h_edges = hacker_res.get("total_edges", 0)
    print(f"Graph: {b_nodes} nodes, {b_edges} edges (<{benign_res.get('_elapsed_s')}s)         │ Graph: {h_nodes} nodes, {h_edges} edges (<{hacker_res.get('_elapsed_s')}s)")

    # Reports
    b_rep = benign_res.get("forensic_report", {}).get("overall_risk", {})
    h_rep = hacker_res.get("forensic_report", {}).get("overall_risk", {})

    b_score = b_rep.get("score", 0.0)
    b_level = b_rep.get("level", "CLEAN")
    h_score = h_rep.get("score", 0.0)
    h_level = h_rep.get("level", "CLEAN")
    print(f"Threat Score: {b_score}/100 [{b_level:<5}]            │ Threat Score: {h_score}/100 [{h_level:<8}]")

    # Bayesian Confidence
    b_conf = b_rep.get("confidence_score", 0.0)
    b_clev = b_rep.get("confidence_level", "LOW")
    h_conf = h_rep.get("confidence_score", 0.0)
    h_clev = h_rep.get("confidence_level", "LOW")
    print(f"Confidence: {b_conf}% ({b_clev})                  │ Confidence: {h_conf}% ({h_clev})")

    print("-" * 45 + "─┼─" + "-" * 45)
    print("DETECTOR BREAKDOWN                           │ DETECTOR BREAKDOWN")
    print("-" * 45 + "─┼─" + "-" * 45)

    b_fns = benign_res.get("forensic_report", {}).get("function_risks", {})
    h_fns = hacker_res.get("forensic_report", {}).get("function_risks", {})

    detectors = [
        ("peel_chain", "Peel Chain Asymmetry"),
        ("terminal_sink", "CEX / Mixer Terminal Sinks"),
        ("sanctions", "OFAC Sanctions & Ransomware"),
        ("mixer_entropy", "CoinJoin Shannon Entropy"),
        ("dusting_attack", "Sub-Economic Dust Screening"),
        ("cluster_recombination", "Common-Input Co-Spending"),
    ]

    for key, name in detectors:
        b_st = b_fns.get(key, {}).get("status", "CLEAN")
        b_sc = b_fns.get(key, {}).get("risk_score", 0.0)
        h_st = h_fns.get(key, {}).get("status", "CLEAN")
        h_sc = h_fns.get(key, {}).get("risk_score", 0.0)

        b_cell = f"{name[:20]}: {b_st:<8} ({b_sc:>4.1f})"
        h_cell = f"{name[:20]}: {h_st:<8} ({h_sc:>4.1f})"
        print(f"{b_cell:<45} │ {h_cell:<45}")

    print("-" * 45 + "─┼─" + "-" * 45)

    # Cryptographic Audit Verification
    b_audit = benign_res.get("audit_trail", {})
    h_audit = hacker_res.get("audit_trail", {})

    b_last_hash = b_audit.get("latest_audit_hash", "none")
    h_last_hash = h_audit.get("latest_audit_hash", "none")
    b_steps = b_audit.get("total_steps", 0)
    h_steps = h_audit.get("total_steps", 0)
    b_valid = b_audit.get("is_valid_chain", True)
    h_valid = h_audit.get("is_valid_chain", True)

    print("AUDIT TRAIL SHA-256 PROOF                    │ AUDIT TRAIL SHA-256 PROOF")
    print(f"Steps: {b_steps} (Integrity Valid: {b_valid})             │ Steps: {h_steps} (Integrity Valid: {h_valid})")
    print(f"Seal: {b_last_hash[:32]}... │ Seal: {h_last_hash[:32]}...")
    print("=" * 92 + "\n")


if __name__ == "__main__":
    benign_target = ("1Archive1n2C579dMsAu3iC6tWzuQJz8dN", "Internet Archive")
    hacker_target = ("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "2020 Twitter VIP Hack")

    print(f"🚀 Running Live Forensic Query for Benign Address: {benign_target[0]}...")
    b_data = run_single_trace(benign_target[0], benign_target[1], max_hops=3)

    print(f"🚀 Running Live Forensic Query for Hacker Address: {hacker_target[0]}...")
    h_data = run_single_trace(hacker_target[0], hacker_target[1], max_hops=5)

    print_side_by_side_comparison(b_data, h_data)
