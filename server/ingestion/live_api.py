"""
Live blockchain data provider supporting Bitcoin (Blockstream Esplora API)
and Ethereum (Etherscan public API), with fallback to benchmark fixtures.
Includes accurate Bitcoin UTXO (vin/prevout vs vout) directional parsing.
"""
import time
from typing import List, Set, Dict
import requests

from core.logger import get_logger
from core.models import Transaction
from forensics.peel_chain import detect_peel_chain
from ingestion.base import BaseBlockchainProvider
from ingestion.benchmark import get_benchmark_transactions, HACKER_SOURCE_BTC, MIXER_SOURCE_ETH

logger = get_logger(__name__)


class UnifiedBlockchainProvider(BaseBlockchainProvider):
    """
    Unified provider that ingests real public blockchain transactions,
    with built-in fallback to reproducible benchmark test scenarios.
    """

    def __init__(self, etherscan_api_key: str = "", timeout_seconds: int = 8):
        self.etherscan_api_key = etherscan_api_key
        self.timeout = timeout_seconds
        self._tx_cache: Dict[str, List[Transaction]] = {}

    def fetch_transactions_for_address(self, address: str) -> List[Transaction]:
        """Fetches transactions for an address, checking cache, benchmarks, or live APIs."""
        clean_addr = address.strip()
        t_start = time.time()

        # In-memory cache hit
        if clean_addr in self._tx_cache:
            cached_txs = self._tx_cache[clean_addr]
            logger.info("   ⚡ [Cache Hit] Address %s... (%d transactions)", clean_addr[:16], len(cached_txs))
            return cached_txs

        # 1. Check if this is a known benchmark address
        if clean_addr in [HACKER_SOURCE_BTC, MIXER_SOURCE_ETH] or "hacker" in clean_addr.lower() or "benchmark" in clean_addr.lower():
            logger.info("   📦 [Benchmark Corpus] Serving deterministic benchmark data for %s", clean_addr)
            txs = get_benchmark_transactions(clean_addr)
            self._tx_cache[clean_addr] = txs
            return txs

        # 2. If it's a Bitcoin address, query Blockstream Esplora API
        if clean_addr.startswith(("bc1", "1", "3")):
            logger.info("   🌐 [Live BTC API] Querying Blockstream Esplora for %s...", clean_addr[:16])
            btc_txs = self._fetch_bitcoin_transactions(clean_addr)
            elapsed_ms = round((time.time() - t_start) * 1000, 1)
            if btc_txs:
                logger.info("   📥 Ingested %d transaction(s) for %s (took %.1fms)", len(btc_txs), clean_addr[:16], elapsed_ms)
                has_out = any(t.from_address == clean_addr for t in btc_txs)
                if has_out:
                    self._tx_cache[clean_addr] = btc_txs
                return btc_txs

        # 3. If it's an Ethereum address, query Etherscan
        if clean_addr.startswith("0x") and len(clean_addr) == 42:
            logger.info("   🌐 [Live ETH API] Querying Etherscan for %s...", clean_addr[:16])
            eth_txs = self._fetch_ethereum_transactions(clean_addr)
            elapsed_ms = round((time.time() - t_start) * 1000, 1)
            if eth_txs:
                logger.info("   📥 Ingested %d transaction(s) for %s (took %.1fms)", len(eth_txs), clean_addr[:16], elapsed_ms)
                self._tx_cache[clean_addr] = eth_txs
                return eth_txs

        # Fallback to benchmark corpus if live APIs return no results or fail
        logger.warning("   ⚠️ Falling back to benchmark data for address %s", clean_addr)
        fallback = get_benchmark_transactions(clean_addr)
        self._tx_cache[clean_addr] = fallback
        return fallback

    def crawl_multihop_transactions(
        self,
        root_address: str,
        max_hops: int = 5,
        max_branches_per_hop: int = 2,
        min_amount_threshold: float = 0.0001,
        max_total_crawled: int = 20,
    ) -> List[Transaction]:
        """
        Recursively crawls live transactions up to max_hops.
        Follows highest-value outgoing transfers to build a multi-hop trace tree.
        Bounded by max_total_crawled to maintain sub-5s response times.
        """
        clean_addr = root_address.strip()

        # For benchmark scenarios, benchmark fixtures already include complete multi-hop chains
        if clean_addr in [HACKER_SOURCE_BTC, MIXER_SOURCE_ETH] or "hacker" in clean_addr.lower() or "benchmark" in clean_addr.lower():
            logger.info("📦 [Crawler] Serving benchmark scenario for %s", clean_addr)
            return get_benchmark_transactions(clean_addr)

        logger.info("🚀 [Crawler] Starting multi-hop discovery for %s (max_hops=%d, limit=%d addresses)", clean_addr, max_hops, max_total_crawled)
        all_transactions: List[Transaction] = []
        seen_keys: Set[str] = set()
        crawled_addresses: Set[str] = set()
        frontier: List[str] = [clean_addr]

        # Entity identification to prevent crawling past terminal entities
        from core.entities import identify_entity

        for hop in range(max_hops):
            logger.info("   ↳ [Hop %d/%d] Frontier contains %d address(es): %s", hop + 1, max_hops, len(frontier), [a[:12] + "..." for a in frontier])
            next_frontier: List[str] = []

            for addr in frontier:
                if addr in crawled_addresses:
                    continue
                if len(crawled_addresses) >= max_total_crawled:
                    break
                crawled_addresses.add(addr)

                # If this address is an exchange cashout or mixer, don't crawl beyond it
                etype, ename, is_term, is_mix = identify_entity(addr)
                if is_term or is_mix:
                    continue

                txs = self.fetch_transactions_for_address(addr)
                if not txs:
                    continue

                outgoing_by_receiver = {}

                for tx in txs:
                    key = f"{tx.tx_hash}_{tx.from_address}_{tx.to_address}"
                    if key not in seen_keys:
                        seen_keys.add(key)
                        all_transactions.append(tx)

                    # Only track outgoing flow from the current investigated address
                    if tx.from_address == addr and tx.to_address != addr:
                        outgoing_by_receiver[tx.to_address] = (
                            outgoing_by_receiver.get(tx.to_address, 0.0) + tx.amount
                        )

                # Prioritize outgoing branches for next hop (Peel chain trunk-focused to allow deep hops)
                if hop < max_hops - 1 and outgoing_by_receiver:
                    peel_candidates = [{"address": r, "value": amt} for r, amt in outgoing_by_receiver.items()]
                    peel_eval = detect_peel_chain(peel_candidates) if len(peel_candidates) >= 2 else None

                    if peel_eval and peel_eval.is_peel_chain and peel_eval.trunk_wallet:
                        logger.info(
                            "      🔬 [Peel Chain Trunk Focus] Directing crawl exclusively down trunk: %s (share=%.1f%%)",
                            peel_eval.trunk_wallet[:12] + "...",
                            peel_eval.trunk_share * 100,
                        )
                        if peel_eval.trunk_wallet not in crawled_addresses:
                            if peel_eval.trunk_wallet not in next_frontier:
                                next_frontier.append(peel_eval.trunk_wallet)
                    else:
                        sorted_receivers = sorted(
                            [
                                (rec, amt)
                                for rec, amt in outgoing_by_receiver.items()
                                if amt >= min_amount_threshold and rec not in crawled_addresses
                            ],
                            key=lambda x: x[1],
                            reverse=True,
                        )
                        for rec, _ in sorted_receivers[:max_branches_per_hop]:
                            if rec not in next_frontier:
                                next_frontier.append(rec)

            frontier = next_frontier
            if not frontier or len(crawled_addresses) >= max_total_crawled:
                break

        return all_transactions

    def _fetch_bitcoin_transactions(self, address: str) -> List[Transaction]:
        """
        Queries Blockstream's public Esplora API for Bitcoin transactions.
        Accurately differentiates inputs (vin/prevout) from outputs (vout).
        """
        url = f"https://blockstream.info/api/address/{address}/txs"
        try:
            resp = requests.get(url, timeout=self.timeout)
            if resp.status_code != 200:
                logger.warning("Blockstream API returned status code %s", resp.status_code)
                return []

            data = resp.json()
            if not isinstance(data, list):
                return []

            transactions: List[Transaction] = []
            seen_edges: Set[str] = set()

            for raw_tx in data:
                tx_id = raw_tx.get("txid", "unknown_tx")
                status = raw_tx.get("status", {})
                block_time = status.get("block_time", 0)
                block_height = status.get("block_height")
                fee_sat = raw_tx.get("fee", 0)
                fee_btc = fee_sat / 100_000_000.0

                vins = raw_tx.get("vin", [])
                vouts = raw_tx.get("vout", [])

                # Check if this is a Coinbase mining reward transaction
                is_coinbase = any(v.get("is_coinbase", False) for v in vins)

                if is_coinbase:
                    # Coinbase reward: newly minted coins
                    for vout in vouts:
                        to_addr = vout.get("scriptpubkey_address")
                        val_btc = vout.get("value", 0) / 100_000_000.0
                        if to_addr == address and val_btc > 0:
                            edge_key = f"{tx_id}_coinbase_{to_addr}"
                            if edge_key not in seen_edges:
                                seen_edges.add(edge_key)
                                transactions.append(
                                    Transaction(
                                        tx_hash=tx_id,
                                        from_address="Coinbase (Mining Reward)",
                                        to_address=to_addr,
                                        amount=round(val_btc, 8),
                                        currency="BTC",
                                        timestamp=block_time,
                                        fee=round(fee_btc, 8),
                                        block_number=block_height,
                                    )
                                )
                    continue

                # Non-coinbase: Extract actual input sender addresses
                input_senders = set()
                for vin in vins:
                    prevout = vin.get("prevout")
                    if prevout and prevout.get("scriptpubkey_address"):
                        input_senders.add(prevout.get("scriptpubkey_address"))

                # Case A: Address is one of the SENDERS (Outgoing transfer)
                if address in input_senders:
                    # Evaluate Peel Chain heuristic on outgoing transaction
                    peel_candidates = [
                        {"address": v.get("scriptpubkey_address", "unknown"), "value": v.get("value", 0) / 100_000_000.0}
                        for v in vouts if v.get("scriptpubkey_address")
                    ]
                    peel_result = detect_peel_chain(peel_candidates)
                    if peel_result.is_peel_chain:
                        logger.info(
                            "   🔬 [Peel Chain Detected] Tx: %s... │ Asymmetry: %.2f │ Trunk: %s (%.1f%%) │ Peeled: %d wallet(s)",
                            tx_id[:12],
                            peel_result.asymmetry_metric,
                            peel_result.trunk_wallet[:16] if peel_result.trunk_wallet else "None",
                            peel_result.trunk_share * 100,
                            len(peel_result.peeled_wallets),
                        )

                    # If this transaction has a huge fanout (e.g. mining pool payout batch),
                    # prioritize the top 25 highest-value outputs to keep latency and payload nimble
                    candidate_vouts = vouts
                    if len(candidate_vouts) > 25:
                        candidate_vouts = sorted(
                            candidate_vouts,
                            key=lambda v: v.get("value", 0),
                            reverse=True,
                        )[:25]

                    for vout in candidate_vouts:
                        to_addr = vout.get("scriptpubkey_address")
                        val_btc = vout.get("value", 0) / 100_000_000.0
                        # Skip change back to self
                        if to_addr and to_addr != address and val_btc > 0:
                            edge_key = f"{tx_id}_{address}_{to_addr}"
                            if edge_key not in seen_edges:
                                seen_edges.add(edge_key)
                                transactions.append(
                                    Transaction(
                                        tx_hash=tx_id,
                                        from_address=address,
                                        to_address=to_addr,
                                        amount=round(val_btc, 8),
                                        currency="BTC",
                                        timestamp=block_time,
                                        fee=round(fee_btc, 8),
                                        block_number=block_height,
                                    )
                                )

                # Case B: Address is one of the RECEIVERS (Incoming transfer)
                else:
                    primary_sender = next(iter(input_senders)) if input_senders else "Unknown_Sender"
                    for vout in vouts:
                        to_addr = vout.get("scriptpubkey_address")
                        val_btc = vout.get("value", 0) / 100_000_000.0
                        if to_addr == address and val_btc > 0:
                            edge_key = f"{tx_id}_{primary_sender}_{address}"
                            if edge_key not in seen_edges:
                                seen_edges.add(edge_key)
                                transactions.append(
                                    Transaction(
                                        tx_hash=tx_id,
                                        from_address=primary_sender,
                                        to_address=address,
                                        amount=round(val_btc, 8),
                                        currency="BTC",
                                        timestamp=block_time,
                                        fee=round(fee_btc, 8),
                                        block_number=block_height,
                                    )
                                )

            # If the address has NO outgoing transactions in the current sample window
            # but has historically spent funds, perform spend-seeking ingestion
            has_outgoing = any(t.from_address == address for t in transactions)
            if not has_outgoing:
                historical_spends = self._fetch_historical_spends_blockchain_info(address, seen_edges)
                if historical_spends:
                    transactions.extend(historical_spends)

            return transactions
        except Exception as exc:
            logger.warning("Failed to fetch live Bitcoin transactions: %s", exc)
            return []

    def _fetch_historical_spends_blockchain_info(
        self, address: str, seen_edges: Set[str], max_spends: int = 15
    ) -> List[Transaction]:
        """
        When the latest 25 transactions contain zero outgoing spends due to incoming dust/noise screening,
        this method locates actual historical spending transactions where funds exited the wallet.
        Checks local historical spend cache first, then queries blockchain.info with offset sampling.
        """
        import os, json

        # 1. Check local persistent store for curated / previously resolved historical spends
        cache_path = os.path.join(os.path.dirname(__file__), "..", "data", "historical_spends.json")
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r") as f:
                    store = json.load(f)
                if address in store and store[address]:
                    cached_records = store[address]
                    spends = []
                    for item in cached_records:
                        edge_key = f"{item['tx_hash']}_{item['from_address']}_{item['to_address']}"
                        if edge_key not in seen_edges:
                            seen_edges.add(edge_key)
                            spends.append(Transaction(**item))
                    if spends:
                        logger.info(
                            "   ⚡ [Spend-Seeking Cache] Loaded %d historical outgoing spend edge(s) for %s from local store",
                            len(spends),
                            address[:16],
                        )
                        return spends
            except Exception as exc:
                logger.warning("Failed reading historical spend cache: %s", exc)

        # 2. Live offset sampling via blockchain.info
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            r = requests.get(f"https://blockchain.info/rawaddr/{address}?limit=1", headers=headers, timeout=self.timeout)
            if r.status_code != 200:
                return []
            data = r.json()
            n_tx = data.get("n_tx", 0)
            if n_tx <= 25:
                return []

            logger.info(
                "   🔍 [Spend-Seeking Ingestion] Address %s has %d total txs but 0 outgoing in recent page. Probing historical spending offsets...",
                address[:16],
                n_tx,
            )

            # Sample offsets across the address's active operational window
            start_offset = max(25, int(n_tx * 0.65))
            end_offset = min(n_tx, int(n_tx * 0.95))
            step = max(50, (end_offset - start_offset) // 6) if end_offset > start_offset else 50

            spends: List[Transaction] = []
            seen_hashes: Set[str] = set()

            for offset in range(start_offset, end_offset + 1, step):
                url = f"https://blockchain.info/rawaddr/{address}?offset={offset}&limit=50"
                res = requests.get(url, headers=headers, timeout=self.timeout)
                if res.status_code != 200:
                    continue

                for raw_tx in res.json().get("txs", []):
                    tx_hash = raw_tx.get("hash")
                    if not tx_hash or tx_hash in seen_hashes:
                        continue

                    # Verify address was an input (actual spend)
                    inputs = [i.get("prev_out", {}).get("addr") for i in raw_tx.get("inputs", [])]
                    if address in inputs:
                        seen_hashes.add(tx_hash)
                        block_time = raw_tx.get("time", 0)
                        block_height = raw_tx.get("block_height")
                        fee_btc = raw_tx.get("fee", 0) / 100_000_000.0

                        for vout in raw_tx.get("out", []):
                            to_addr = vout.get("addr")
                            val_btc = vout.get("value", 0) / 100_000_000.0
                            if to_addr and to_addr != address and val_btc > 0:
                                edge_key = f"{tx_hash}_{address}_{to_addr}"
                                if edge_key not in seen_edges:
                                    seen_edges.add(edge_key)
                                    spends.append(
                                        Transaction(
                                            tx_hash=tx_hash,
                                            from_address=address,
                                            to_address=to_addr,
                                            amount=round(val_btc, 8),
                                            currency="BTC",
                                            timestamp=block_time,
                                            fee=round(fee_btc, 8),
                                            block_number=block_height,
                                        )
                                    )

                        if len(seen_hashes) >= max_spends:
                            break

                if len(seen_hashes) >= max_spends:
                    break

            if spends:
                logger.info(
                    "   📥 [Spend-Seeking Ingestion] Extracted %d outgoing spend edge(s) across %d historical transactions for %s",
                    len(spends),
                    len(seen_hashes),
                    address[:16],
                )
                # Persist discovered spends
                try:
                    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                    existing = {}
                    if os.path.exists(cache_path):
                        with open(cache_path, "r") as f:
                            existing = json.load(f)
                    existing[address] = [s.dict() for s in spends]
                    with open(cache_path, "w") as f:
                        json.dump(existing, f, indent=2)
                except Exception:
                    pass

            return spends
        except Exception as exc:
            logger.warning("Historical spend-seeking failed for %s: %s", address[:16], exc)
            return []

    def _fetch_ethereum_transactions(self, address: str) -> List[Transaction]:
        """Queries Etherscan public API for account transactions."""
        url = (
            f"https://api.etherscan.io/api?module=account&action=txlist"
            f"&address={address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc"
        )
        if self.etherscan_api_key:
            url += f"&apikey={self.etherscan_api_key}"

        try:
            resp = requests.get(url, timeout=self.timeout)
            if resp.status_code != 200:
                return []

            result = resp.json().get("result", [])
            if not isinstance(result, list):
                return []

            transactions: List[Transaction] = []
            for raw_tx in result:
                from_addr = raw_tx.get("from", "").lower()
                to_addr = raw_tx.get("to", "").lower()
                val_wei = int(raw_tx.get("value", 0))
                val_eth = val_wei / 1e18
                gas_used = int(raw_tx.get("gasUsed", 0))
                gas_price = int(raw_tx.get("gasPrice", 0))
                fee_eth = (gas_used * gas_price) / 1e18

                if from_addr == address.lower() and to_addr and val_eth > 0:
                    transactions.append(
                        Transaction(
                            tx_hash=raw_tx.get("hash", ""),
                            from_address=from_addr,
                            to_address=to_addr,
                            amount=round(val_eth, 6),
                            currency="ETH",
                            timestamp=int(raw_tx.get("timeStamp", 0)),
                            fee=round(fee_eth, 6),
                            block_number=int(raw_tx.get("blockNumber", 0)),
                        )
                    )
            return transactions
        except Exception as exc:
            logger.warning("Failed to fetch live Ethereum transactions: %s", exc)
            return []
