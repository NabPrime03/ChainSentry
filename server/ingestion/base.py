"""
Base interface for blockchain data ingestion providers.
"""
from abc import ABC, abstractmethod
from typing import List
from core.models import Transaction


class BaseBlockchainProvider(ABC):
    """Abstract interface for fetching transaction records for an address."""

    @abstractmethod
    def fetch_transactions_for_address(self, address: str) -> List[Transaction]:
        """Fetches incoming and outgoing transactions for a given wallet address."""
        pass
