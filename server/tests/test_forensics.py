"""
Unit tests for the CryptoTrace Forensics Pipeline.
"""
import pytest
from forensics.peel_chain import detect_peel_chain, PeelChainResult
from forensics.pipeline import ForensicPipeline, ForensicReport
from core.models import Transaction, AddressNode, EndReceiverSummary


def test_peel_chain_classic_2_output():
    """Test Case 1: [98, 2] BTC -> delta = 0.96 >= 0.85 -> True"""
    outputs = [
        {"address": "1ChangeWallet98BTC", "value": 98.0},
        {"address": "1MerchantSpend2BTC", "value": 2.0},
    ]
    result = detect_peel_chain(outputs)
    assert result.is_peel_chain is True
    assert result.asymmetry_metric == 0.96
    assert result.trunk_wallet == "1ChangeWallet98BTC"
    assert result.peeled_wallets == ["1MerchantSpend2BTC"]
    assert result.trunk_share == 0.98


def test_peel_chain_multi_output_batch():
    """Test Case 2: [94, 2, 1, 3] BTC -> v_max = 94, v_peeled = 6 -> delta = 0.88 >= 0.85 -> True"""
    outputs = [
        {"address": "1ChangeWallet94BTC", "value": 94.0},
        {"address": "1MerchantA", "value": 2.0},
        {"address": "1MerchantB", "value": 1.0},
        {"address": "1MerchantC", "value": 3.0},
    ]
    result = detect_peel_chain(outputs)
    assert result.is_peel_chain is True
    assert result.asymmetry_metric == 0.88
    assert result.trunk_wallet == "1ChangeWallet94BTC"
    assert len(result.peeled_wallets) == 3
    assert "1MerchantA" in result.peeled_wallets
    assert "1MerchantB" in result.peeled_wallets
    assert "1MerchantC" in result.peeled_wallets


def test_peel_chain_multi_trunk_split_rejected():
    """Test Case 3: [50, 30, 10, 6, 2, 2] BTC -> v_max = 50, v_peeled = 50 -> delta = 0.0 -> False"""
    outputs = [
        {"address": "1MuleA_50BTC", "value": 50.0},
        {"address": "1MuleB_30BTC", "value": 30.0},
        {"address": "1MuleC_10BTC", "value": 10.0},
        {"address": "1DecoyA_6BTC", "value": 6.0},
        {"address": "1DecoyB_2BTC", "value": 2.0},
        {"address": "1DecoyC_2BTC", "value": 2.0},
    ]
    result = detect_peel_chain(outputs)
    assert result.is_peel_chain is False
    assert result.asymmetry_metric == 0.0
    assert result.trunk_wallet is None
    assert result.peeled_wallets == []


def test_peel_chain_equal_split_rejected():
    """Test Case 4: [50, 50] BTC -> delta = 0.0 -> False"""
    outputs = [
        {"address": "1SplitA", "value": 50.0},
        {"address": "1SplitB", "value": 50.0},
    ]
    result = detect_peel_chain(outputs)
    assert result.is_peel_chain is False
    assert result.asymmetry_metric == 0.0
    assert result.trunk_wallet is None


def test_peel_chain_edge_cases():
    """Test single output, empty list, and zero-value outputs."""
    assert detect_peel_chain([]).is_peel_chain is False
    assert detect_peel_chain([{"address": "1Single", "value": 10.0}]).is_peel_chain is False
    
    # Zero value outputs
    zero_outs = [
        {"address": "1ZeroA", "value": 0.0},
        {"address": "1ZeroB", "value": 0.0},
    ]
    assert detect_peel_chain(zero_outs).is_peel_chain is False


def test_forensic_pipeline_peel_chain_and_sink():
    """Verify master pipeline aggregates peel chain hops and exchange sink."""
    pipeline = ForensicPipeline()
    
    # 2 consecutive peel hops:
    # Hop 0: Target -> Trunk1 (98 BTC), Peel1 (2 BTC)
    # Hop 1: Trunk1 -> Trunk2 (96 BTC), Peel2 (2 BTC)
    txs = [
        Transaction(tx_hash="tx1", from_address="1TargetAddr", to_address="1Trunk1", amount=98.0, timestamp=1000),
        Transaction(tx_hash="tx1", from_address="1TargetAddr", to_address="1Peel1", amount=2.0, timestamp=1000),
        Transaction(tx_hash="tx2", from_address="1Trunk1", to_address="1Trunk2", amount=96.0, timestamp=1010),
        Transaction(tx_hash="tx2", from_address="1Trunk1", to_address="1Peel2", amount=2.0, timestamp=1010),
    ]
    nodes = [
        AddressNode(address="1TargetAddr", is_source=True, hop_distance=0),
        AddressNode(address="1Trunk1", hop_distance=1),
        AddressNode(address="1Peel1", hop_distance=1),
        AddressNode(address="1Trunk2", hop_distance=2),
        AddressNode(address="1Peel2", hop_distance=2),
    ]
    receivers = [
        EndReceiverSummary(
            address="bc1q_binance_deposit_exchange",
            hop_depth=2,
            amount_reached=96.0,
            path=["1TargetAddr", "1Trunk1", "1Trunk2"],
            is_terminal_cashout=True,
            stopping_reason="Exchange cashout"
        )
    ]
    
    report: ForensicReport = pipeline.analyze(
        target_address="1TargetAddr",
        nodes=nodes,
        transactions=txs,
        end_receivers=receivers,
        max_hops=2,
    )
    
    assert report.target_address == "1TargetAddr"
    assert report.function_risks["peel_chain"].status == "FLAGGED"
    assert "consecutive peel hops" in report.function_risks["peel_chain"].reason
    assert report.function_risks["terminal_sink"].status == "FLAGGED"
    assert report.overall_risk.score >= 50.0
    assert report.overall_risk.level in ["HIGH", "CRITICAL"]
    assert "peel hops" in report.overall_risk.summary.lower()


def test_forensic_pipeline_sanctioned_direct_hit():
    """Verify master pipeline detects direct OFAC sanction entity hit."""
    pipeline = ForensicPipeline()
    nodes = [
        AddressNode(address="13AM4VW2dhxYgXeQepoHkHSQuy6NgaEb94", is_source=True, hop_distance=0)
    ]
    report = pipeline.analyze(
        target_address="13AM4VW2dhxYgXeQepoHkHSQuy6NgaEb94",
        nodes=nodes,
        transactions=[],
        end_receivers=[],
        max_hops=1,
    )
    assert report.function_risks["sanctions"].status == "FLAGGED"
    assert report.overall_risk.score == 100.0
    assert report.overall_risk.level == "CRITICAL"
    assert "directly registered" in report.function_risks["sanctions"].reason


def test_forensic_pipeline_dusting_and_poisoning():
    """Verify master pipeline detects dusting attacks and address poisoning."""
    pipeline = ForensicPipeline()
    dust_txs = [
        Transaction(tx_hash=f"tx_dust_{i}", from_address=f"1Attacker_{i}", to_address="1Victim", amount=0.00000546, timestamp=1000 + i)
        for i in range(6)
    ]
    # Add an address poisoning transaction with look-alike vanity match
    poison_tx = Transaction(
        tx_hash="tx_poison",
        from_address="1VicXFake99tim",
        to_address="1Victim",
        amount=0.0,
        timestamp=1020,
        adversarial_tag="ADDRESS_POISONING"
    )
    dust_txs.append(poison_tx)
    nodes = [AddressNode(address="1Victim", is_source=True, hop_distance=0)]
    
    report = pipeline.analyze(
        target_address="1Victim",
        nodes=nodes,
        transactions=dust_txs,
        end_receivers=[],
        max_hops=1,
    )
    assert report.function_risks["dusting_attack"].status == "FLAGGED"
    assert report.function_risks["dusting_attack"].risk_score == 40.0
    assert report.function_risks["address_poisoning"].status == "FLAGGED"
    assert report.function_risks["address_poisoning"].risk_score == 35.0


def test_forensic_pipeline_mixer_entropy():
    """Verify Shannon entropy detector flags equal-denomination mixer outputs."""
    pipeline = ForensicPipeline()
    # 5 equal outputs of 0.1 BTC (Wasabi / CoinJoin pool)
    mixer_txs = [
        Transaction(tx_hash="tx_mix_pool", from_address="1Participant", to_address=f"1Anonymity_{i}", amount=0.1, timestamp=2000)
        for i in range(5)
    ]
    nodes = [AddressNode(address="1Participant", is_source=True, hop_distance=0)]
    report = pipeline.analyze(
        target_address="1Participant",
        nodes=nodes,
        transactions=mixer_txs,
        end_receivers=[],
        max_hops=1,
    )
    assert report.function_risks["mixer_entropy"].status == "FLAGGED"
    assert report.function_risks["mixer_entropy"].risk_score == 45.0
    assert "equal-denomination mixer pool" in report.function_risks["mixer_entropy"].reason.lower()


