"""
Curated forensic benchmark scenarios for reproducible testing and evaluation.
Includes:
1. Peel Chain with Exchange Cash-Out & Adversarial Dusting/Poisoning
2. Mixer Fan-In / Fan-Out Tumbler Pattern
"""
from typing import List, Dict
from core.models import Transaction

# Scenario 1: Bitcoin Ransomware Heist + 3-Hop Peel Chain + Dusting + Address Poisoning
HACKER_SOURCE_BTC = "bc1q_hacker_ransomware_vault"
EXCHANGE_CASHOUT_BTC = "bc1q_binance_deposit_exchange"
DUSTING_VICTIM_BTC = "bc1q_innocent_dusting_victim"
POISONING_ATTACK_BTC = "bc1q_lookalike_spoofed_victim"

BENCHMARK_TRANSACTIONS_BTC: List[Transaction] = [
    # Hop 1 from Hacker Source:
    # 47.9 BTC to Change Address 1 (Peel-chain main trunk)
    # 2.0 BTC to illicit darkweb service
    # 0.00008 BTC Dusting attack to innocent victim
    # 0.0 BTC address poisoning transaction
    Transaction(
        tx_hash="tx_hop1_trunk_001",
        from_address=HACKER_SOURCE_BTC,
        to_address="bc1q_change_hop1",
        amount=47.9,
        currency="BTC",
        timestamp=1700000100,
        fee=0.001,
        block_number=800100,
    ),
    Transaction(
        tx_hash="tx_hop1_peel_002",
        from_address=HACKER_SOURCE_BTC,
        to_address="bc1q_darkweb_service",
        amount=2.0,
        currency="BTC",
        timestamp=1700000100,
        fee=0.001,
        block_number=800100,
    ),
    Transaction(
        tx_hash="tx_hop1_dust_003",
        from_address=HACKER_SOURCE_BTC,
        to_address=DUSTING_VICTIM_BTC,
        amount=0.00008,
        currency="BTC",
        timestamp=1700000115,
        fee=0.0005,
        block_number=800101,
        is_adversarial=True,
        adversarial_tag="DUSTING_ATTACK",
    ),
    Transaction(
        tx_hash="tx_hop1_poison_004",
        from_address=HACKER_SOURCE_BTC,
        to_address=POISONING_ATTACK_BTC,
        amount=0.0,
        currency="BTC",
        timestamp=1700000120,
        fee=0.0002,
        block_number=800101,
        is_adversarial=True,
        adversarial_tag="ADDRESS_POISONING",
    ),

    # Hop 2 from Change Hop 1:
    Transaction(
        tx_hash="tx_hop2_trunk_005",
        from_address="bc1q_change_hop1",
        to_address="bc1q_change_hop2",
        amount=44.5,
        currency="BTC",
        timestamp=1700003600,
        fee=0.001,
        block_number=800110,
    ),
    Transaction(
        tx_hash="tx_hop2_peel_006",
        from_address="bc1q_change_hop1",
        to_address="bc1q_p2p_broker_peel",
        amount=3.399,
        currency="BTC",
        timestamp=1700003600,
        fee=0.001,
        block_number=800110,
    ),

    # Hop 3 from Change Hop 2:
    # 40.0 BTC to Binance Deposit (Cash-out point!)
    # 4.499 BTC to Change Hop 3
    Transaction(
        tx_hash="tx_hop3_cashout_007",
        from_address="bc1q_change_hop2",
        to_address=EXCHANGE_CASHOUT_BTC,
        amount=40.0,
        currency="BTC",
        timestamp=1700007200,
        fee=0.001,
        block_number=800120,
    ),
    Transaction(
        tx_hash="tx_hop3_trunk_008",
        from_address="bc1q_change_hop2",
        to_address="bc1q_change_hop3",
        amount=4.499,
        currency="BTC",
        timestamp=1700007200,
        fee=0.001,
        block_number=800120,
    ),
]

# Scenario 2: Ethereum Mixer Scenario
MIXER_SOURCE_ETH = "0xHacker_Ethereum_Vault_7a1b"
MIXER_POOL_ETH = "0xTornado_Cash_Router_Pool_99"

BENCHMARK_TRANSACTIONS_ETH: List[Transaction] = [
    Transaction(
        tx_hash="0xeth_tx_01",
        from_address=MIXER_SOURCE_ETH,
        to_address=MIXER_POOL_ETH,
        amount=10.0,
        currency="ETH",
        timestamp=1710000000,
        fee=0.005,
    ),
    Transaction(
        tx_hash="0xeth_tx_02",
        from_address=MIXER_SOURCE_ETH,
        to_address=MIXER_POOL_ETH,
        amount=10.0,
        currency="ETH",
        timestamp=1710000050,
        fee=0.005,
    ),
    Transaction(
        tx_hash="0xeth_tx_03",
        from_address=MIXER_POOL_ETH,
        to_address="0xRecipient_Clean_Alpha_11",
        amount=9.95,
        currency="ETH",
        timestamp=1710005000,
        fee=0.005,
    ),
    Transaction(
        tx_hash="0xeth_tx_04",
        from_address=MIXER_POOL_ETH,
        to_address="0xRecipient_Clean_Beta_22",
        amount=9.95,
        currency="ETH",
        timestamp=1710006000,
        fee=0.005,
    ),
]


def get_benchmark_transactions(address: str) -> List[Transaction]:
    """Returns transactions relevant to the address from our benchmark corpus."""
    if "eth" in address.lower() or address.startswith("0x"):
        return [
            tx for tx in BENCHMARK_TRANSACTIONS_ETH
            if tx.from_address == address or tx.to_address == address or address in [MIXER_SOURCE_ETH, MIXER_POOL_ETH]
        ]
    # Default to BTC benchmark
    return [
        tx for tx in BENCHMARK_TRANSACTIONS_BTC
        if tx.from_address == address or tx.to_address == address or address == HACKER_SOURCE_BTC
    ]
