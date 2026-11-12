"""
Unit tests for the CryptoTrace Forensics Pipeline.
"""
import pytest
from forensics.peel_chain import detect_peel_chain, PeelChainResult


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
