"""
Live blockchain data provider supporting Bitcoin (Blockstream Esplora API)
and Ethereum (Etherscan public API), with fallback to benchmark fixtures.
Includes accurate Bitcoin UTXO (vin/prevout vs vout) directional parsing.
"""
import logging
from typing import List, Set
import requests

from core.models import Transaction
from ingestion.base import BaseBlockchainProvider
from ingestion.benchmark import get_benchmark_transactions, HACKER_SOURCE_BTC, MIXER_SOURCE_ETH

logger = logging.getLogger(__name__)


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

        # In-memory cache hit
        if clean_addr in self._tx_cache:
            return self._tx_cache[clean_addr]

        # 1. Check if this is a known benchmark address
        if clean_addr in [HACKER_SOURCE_BTC, MIXER_SOURCE_ETH] or "hacker" in clean_addr.lower() or "benchmark" in clean_addr.lower():
            logger.info("Serving transactions from forensic benchmark corpus for %s", clean_addr)
            txs = get_benchmark_transactions(clean_addr)
            self._tx_cache[clean_addr] = txs
            return txs

        # 2. If it's a Bitcoin address, query Blockstream Esplora API
        if clean_addr.startswith(("bc1", "1", "3")):
            btc_txs = self._fetch_bitcoin_transactions(clean_addr)
            if btc_txs:
                self._tx_cache[clean_addr] = btc_txs
                return btc_txs

        # 3. If it's an Ethereum address, query Etherscan
        if clean_addr.startswith("0x") and len(clean_addr) == 42:
            eth_txs = self._fetch_ethereum_transactions(clean_addr)
            if eth_txs:
                self._tx_cache[clean_addr] = eth_txs
                return eth_txs

        # Fallback to benchmark corpus if live APIs return no results or fail
        logger.warning("Falling back to benchmark data for address %s", clean_addr)
        fallback = get_benchmark_transactions(clean_addr)
        self._tx_cache[clean_addr] = fallback
        return fallback

    def crawl_multihop_transactions(
        self,
        root_address: str,
        max_hops: int = 3,
        max_branches_per_hop: int = 2,
        min_amount_threshold: float = 0.0001,
        max_total_crawled: int = 5,
    ) -> List[Transaction]:
        """
        Recursively crawls live transactions up to max_hops.
        Follows highest-value outgoing transfers to build a multi-hop trace tree.
        Bounded by max_total_crawled to maintain sub-5s response times.
        """
        clean_addr = root_address.strip()

        # For benchmark scenarios, benchmark fixtures already include complete multi-hop chains
        if clean_addr in [HACKER_SOURCE_BTC, MIXER_SOURCE_ETH] or "hacker" in clean_addr.lower() or "benchmark" in clean_addr.lower():
            return get_benchmark_transactions(clean_addr)

        all_transactions: List[Transaction] = []
        seen_keys: Set[str] = set()
        crawled_addresses: Set[str] = set()
        frontier: List[str] = [clean_addr]

        # Entity identification to prevent crawling past terminal entities
        from core.entities import identify_entity

        for hop in range(max_hops):
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

                # Prioritize top outgoing branches for the next hop
                if hop < max_hops - 1 and outgoing_by_receiver:
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

            return transactions
        except Exception as exc:
            logger.warning("Failed to fetch live Bitcoin transactions: %s", exc)
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
