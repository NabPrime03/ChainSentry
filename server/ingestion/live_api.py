"""
Live blockchain data provider supporting Bitcoin (Blockstream Esplora API)
and Ethereum (Etherscan public API), with fallback to benchmark fixtures.
"""
import logging
from typing import List
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

    def __init__(self, etherscan_api_key: str = "", timeout_seconds: int = 6):
        self.etherscan_api_key = etherscan_api_key
        self.timeout = timeout_seconds

    def fetch_transactions_for_address(self, address: str) -> List[Transaction]:
        """Fetches transactions for an address, checking benchmarks or live APIs."""
        # 1. Check if this is a known benchmark address
        if address in [HACKER_SOURCE_BTC, MIXER_SOURCE_ETH] or "hacker" in address.lower() or "benchmark" in address.lower():
            logger.info("Serving transactions from forensic benchmark corpus for %s", address)
            return get_benchmark_transactions(address)

        # 2. If it's a Bitcoin address, query Blockstream Esplora API
        if address.startswith(("bc1", "1", "3")):
            btc_txs = self._fetch_bitcoin_transactions(address)
            if btc_txs:
                return btc_txs

        # 3. If it's an Ethereum address, query Etherscan
        if address.startswith("0x") and len(address) == 42:
            eth_txs = self._fetch_ethereum_transactions(address)
            if eth_txs:
                return eth_txs

        # Fallback to benchmark corpus if live APIs return no results or fail
        logger.warning("Falling back to benchmark data for address %s", address)
        return get_benchmark_transactions(address)

    def _fetch_bitcoin_transactions(self, address: str) -> List[Transaction]:
        """Queries Blockstream's public Esplora API for Bitcoin transactions."""
        url = f"https://blockstream.info/api/address/{address}/txs"
        try:
            resp = requests.get(url, timeout=self.timeout)
            if resp.status_code != 200:
                return []

            data = resp.json()
            transactions: List[Transaction] = []

            for raw_tx in data:
                tx_id = raw_tx.get("txid", "unknown_tx")
                status = raw_tx.get("status", {})
                block_time = status.get("block_time", 0)
                block_height = status.get("block_height")
                fee_sat = raw_tx.get("fee", 0)
                fee_btc = fee_sat / 100_000_000.0

                # Analyze outputs
                for vout in raw_tx.get("vout", []):
                    to_addr = vout.get("scriptpubkey_address")
                    val_sat = vout.get("value", 0)
                    amount_btc = val_sat / 100_000_000.0

                    if to_addr and to_addr != address:
                        transactions.append(
                            Transaction(
                                tx_hash=tx_id,
                                from_address=address,
                                to_address=to_addr,
                                amount=round(amount_btc, 8),
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

                if from_addr == address.lower() and to_addr:
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
