"""
Forensic audit trail logger using cryptographic SHA-256 hash chaining.
Maintains an immutable chain-of-custody recording every traversed node,
ingested transaction, and forensic stopping decision.
"""
import hashlib
import json
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AuditStep(BaseModel):
    """Represents a single tamper-evident step in the forensic investigation."""
    step_number: int
    step_type: str = Field(..., description="INGESTION, TRAVERSAL, FILTERING, or STOPPING")
    node_address: str
    hop_depth: int
    details: Dict[str, Any]
    timestamp: float
    prev_hash: str
    step_hash: str


class AuditTrail:
    """Manages the cryptographic hash chain for the investigation."""

    GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

    def __init__(self, target_address: str):
        self.target_address = target_address
        self.steps: List[AuditStep] = []
        self.current_hash = self.GENESIS_HASH
        self._initialize_chain()

    def _initialize_chain(self) -> None:
        """Logs the genesis step of the investigation."""
        self.record_step(
            step_type="INVESTIGATION_INITIALIZED",
            node_address=self.target_address,
            hop_depth=0,
            details={"action": "Forensic trace initialized for target address"},
        )

    def record_step(
        self,
        step_type: str,
        node_address: str,
        hop_depth: int,
        details: Dict[str, Any],
    ) -> AuditStep:
        """
        Creates a new immutable audit record, cryptographically chained to the previous hash.
        """
        step_number = len(self.steps) + 1
        now = time.time()

        payload = {
            "step_number": step_number,
            "step_type": step_type,
            "node_address": node_address,
            "hop_depth": hop_depth,
            "details": details,
            "timestamp": now,
            "prev_hash": self.current_hash,
        }

        # Compute SHA-256 hash of serialized payload
        serialized = json.dumps(payload, sort_keys=True)
        step_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        step_record = AuditStep(
            step_number=step_number,
            step_type=step_type,
            node_address=node_address,
            hop_depth=hop_depth,
            details=details,
            timestamp=now,
            prev_hash=self.current_hash,
            step_hash=step_hash,
        )

        self.steps.append(step_record)
        self.current_hash = step_hash
        return step_record

    def verify_integrity(self) -> bool:
        """Verifies that no record in the audit chain has been modified or tampered with."""
        prev = self.GENESIS_HASH
        for step in self.steps:
            if step.prev_hash != prev:
                return False
            payload = {
                "step_number": step.step_number,
                "step_type": step.step_type,
                "node_address": step.node_address,
                "hop_depth": step.hop_depth,
                "details": step.details,
                "timestamp": step.timestamp,
                "prev_hash": step.prev_hash,
            }
            computed = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
            if computed != step.step_hash:
                return False
            prev = step.step_hash
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Exports the audit trail for API serialization."""
        return {
            "target_address": self.target_address,
            "total_steps": len(self.steps),
            "is_valid_chain": self.verify_integrity(),
            "latest_audit_hash": self.current_hash,
            "steps": [s.model_dump() for s in self.steps],
        }
