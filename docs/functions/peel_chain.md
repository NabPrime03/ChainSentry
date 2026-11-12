# Forensic Function Specification: `detect_peel_chain()`

This document contains the formal mathematical equations, algorithmic logic, test cases, and problem-solving mappings for the **Peel Chain & Change Address Detector** implemented in CryptoTrace.

---

## 1. Function Identifier & Interface

```python
def detect_peel_chain(outputs: list[dict]) -> dict:
    """
    Evaluates generalized peel chain asymmetry across 2 or more transaction outputs.
    
    Inputs:
        outputs: list of dicts, each with keys:
                 - "address": str (recipient public key hash)
                 - "value": float | int (satoshis or BTC)
                 
    Returns:
        {
            "is_peel_chain": bool,
            "asymmetry_metric": float,       # [-1.0, 1.0]
            "trunk_wallet": str | None,      # Address holding the unspent change
            "peeled_wallets": list[str]      # List of addresses receiving peeled expenses
        }
    """
```

---

## 2. Forensic Context & Threat Scenario

When an adversary (such as a ransomware operator or hacker) launders cryptocurrency, they typically peel off small payments for infrastructure, VPNs, bulletproof hosting, or cashing out, while the bulk of the unspent funds moves to a newly generated **change address**:

```
[Hacker: 100 BTC] ──► Tx 1 ──┬──► [Peeled Spend: 2 BTC]  (Hosting provider)
                             └──► [Change Wallet: 98 BTC] 
                                         │
                                         ▼
                                       Tx 2 ──┬──► [Peeled Spend: 2 BTC]
                                              └──► [Change Wallet: 96 BTC] ...
```

Because Bitcoin and UTXO-based blockchains do not explicitly tag which output is the merchant payment versus which is the owner's change address, naive graph tracers cannot distinguish the primary money flow from incidental expenses.

---

## 3. Mathematical Formulation: Generalized One-vs-Rest Asymmetry

To handle both standard 2-output transactions and multi-output batch transactions, we generalize the asymmetry calculation by comparing the single largest output against the sum of all other outputs.

Let a transaction $T$ have $k \ge 2$ outputs with amounts $\{v_1, v_2, \dots, v_k\}$:

### Step 1: Maximum Output Identification
$$v_{\max} = \max(\{v_1, v_2, \dots, v_k\})$$

### Step 2: Sum of Minor Peeled Outputs
$$V_{\text{peeled}} = \sum_{i=1}^k v_i - v_{\max}$$

### Step 3: Generalized Asymmetry Metric ($\Delta_{\text{peel}}$)
$$\Delta_{\text{peel}} = \frac{v_{\max} - V_{\text{peeled}}}{v_{\max} + V_{\text{peeled}}} \in [-1.0, 1.0]$$

---

## 4. Decision Rule & Boundary Conditions

A transaction is classified as an **Active Peel Chain Step** if:

$$\text{IsPeelChain}(T) = \begin{cases} 
\mathbf{True}, & \text{if } \Delta_{\text{peel}} \ge 0.85 \quad (v_{\max} \ge 92.5\% \text{ of total volume}) \\
\mathbf{False}, & \text{otherwise}
\end{cases}$$

When $\text{IsPeelChain} == \mathbf{True}$:
- $\text{Address}(v_{\max})$ $\to$ **`TRUNK_CHANGE_WALLET`** (The ongoing criminal conduit to follow).
- $\text{Addresses}(V_{\text{peeled}})$ $\to$ **`PEELED_EXPENSES`** (Outside merchants, fees, or small services).

---

## 5. Comparative Evaluation Across Real-World Cases

| Scenario | Output Distribution | $v_{\max}$ vs. $V_{\text{peeled}}$ | Calculated $\Delta_{\text{peel}}$ | Classification Verdict | Action Taken |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Case 1: Classic 2-Output Peel** | $[98, 2]$ | $98$ vs. $2$ | $\frac{98 - 2}{100} = \mathbf{0.96}$ | ✅ **`PEEL_CHAIN_STEP`** | Track $98\text{ BTC}$ trunk; flag $2\text{ BTC}$ as payment. |
| **Case 2: Multi-Output Batch Peel** | $[94, 2, 1, 3]$ | $94$ vs. $6$ | $\frac{94 - 6}{100} = \mathbf{0.88}$ | ✅ **`PEEL_CHAIN_STEP`** | Track $94\text{ BTC}$ trunk; flag $[2, 1, 3]\text{ BTC}$ as expenses. |
| **Case 3: Multi-Trunk Split** | $[50, 30, 10, 6, 2, 2]$ | $50$ vs. $50$ | $\frac{50 - 50}{100} = \mathbf{0.00}$ | ❌ **`MULTI_TRUNK_SPLIT`** | Handed off to Multi-Trunk Top-K dominance scoring. |

---

## 6. Python Implementation Blueprint

```python
def detect_peel_chain(outputs: list[dict]) -> dict:
    """
    Evaluates generalized peel chain asymmetry across 2 or more outputs.
    """
    if len(outputs) < 2:
        return {
            "is_peel_chain": False,
            "asymmetry_metric": 0.0,
            "trunk_wallet": None,
            "peeled_wallets": []
        }

    # Sort outputs descending by amount
    sorted_outs = sorted(outputs, key=lambda x: x["value"], reverse=True)
    v_max_node = sorted_outs[0]
    v_max = v_max_node["value"]
    
    v_peeled_nodes = sorted_outs[1:]
    v_peeled_sum = sum(out["value"] for out in v_peeled_nodes)
    
    total = v_max + v_peeled_sum
    if total <= 0:
        return {
            "is_peel_chain": False,
            "asymmetry_metric": 0.0,
            "trunk_wallet": None,
            "peeled_wallets": []
        }
    
    delta_peel = (v_max - v_peeled_sum) / total
    is_peel = delta_peel >= 0.85
    
    return {
        "is_peel_chain": is_peel,
        "asymmetry_metric": round(delta_peel, 4),
        "trunk_wallet": v_max_node["address"] if is_peel else None,
        "peeled_wallets": [out["address"] for out in v_peeled_nodes] if is_peel else []
    }
```

---

## 7. Forensic Problems Solved

This function directly solves and contributes to the following items from our master [Forensic Problems & Solution Tracker](file:///home/nab/hackathon/cryptotrace/docs/forensic_problems_and_solutions.md):

1. **Problem #8: Change Address Confusion (UTXO Asymmetry)**
   - *Failure Without Math:* A tracer cannot distinguish between the recipient payment and the owner's change address, leading to incorrect path traversal.
   - *How it Solves:* Quantifies the asymmetry metric $\Delta_{\text{peel}} \ge 0.85$ to definitively identify the change wallet ($v_{\max}$) versus merchant outputs ($V_{\text{peeled}}$).

2. **Problem #1: Graph Explosion Mitigation**
   - *How it Contributes:* In a peel chain transaction, tracing does not need to fan out symmetrically into both branches. It prioritizes the single trunk change wallet ($v_{\max}$), preventing unnecessary branch factor inflation.
