# CryptoTrace — Mathematical, Probabilistic & Forensic Function Framework

This document outlines the formal mathematical formulations, probabilistic models, and algorithmic function specifications implemented in **CryptoTrace** for confidence-aware blockchain forensics, risk classification, and adversarial transaction detection.

---

## 1. Executive Function Reference Matrix

| # | Function Identifier | Primary Forensic Question | Mathematical / Algorithmic Model |
| :---: | :--- | :--- | :--- |
| **1** | `calculate_risk_score()` | *"Is this wallet dangerous or legit?"* | Logistic Sigmoid ($\sigma(z)$) + Multi-Hop Attenuation ($\gamma^d$) |
| **2** | `calculate_confidence()` | *"Do we have enough data to trust this conclusion?"* | Bayesian Evidence Saturation ($\mathcal{C}(N, V) = (1 - e^{-\lambda N})$) |
| **3** | `detect_peel_chain()` | *"Is the hacker peeling off stolen funds hop-by-hop?"* | Asymmetry Metric ($\Delta_{\text{peel}}$) + Gini Coefficient ($G$) |
| **4** | `detect_mixer_entropy()` | *"Are they running money through a tumbler/mixer?"* | Shannon Information Entropy ($H(X)$) & Normalized Entropy ($E_{\text{norm}}$) |
| **5** | `filter_dusting_attack()` | *"Is this tiny transfer an adversarial trap?"* | Sub-economic UTXO threshold filter ($\le 546\text{ satoshis}$) |
| **6** | `detect_address_poisoning()`| *"Is someone trying to spoof a look-alike address?"* | Hamming/Prefix-Suffix Match ($L_{\text{prefix}} \ge 4 \land L_{\text{suffix}} \ge 4$) + 0-value check |

---

## 2. Deep Dive: Core Forensic Functions & Mathematical Formulations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CRYPTOTRACE FORENSIC PIPELINE                            │
│                                                                             │
│  [ Transaction Feed ]                                                       │
│          │                                                                  │
│          ├──► filter_dusting_attack()        (Prunes sub-economic traps)    │
│          ├──► detect_address_poisoning()     (Catches vanity spoofers)      │
│          ├──► detect_peel_chain()            (Flags asymmetric laundering)  │
│          ├──► detect_mixer_entropy()         (Flags equal-slice tumblers)   │
│          │                                                                  │
│          ▼                                                                  │
│  [ Feature Aggregation Vector x ]                                           │
│          │                                                                  │
│          ├──► calculate_risk_score(x)        (Sigmoid Threat Score 0-100)   │
│          └──► calculate_confidence(N, V)     (Bayesian Certainty 0-100%)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Function 1: `calculate_risk_score(address_node, graph)`
> **Question Answered:** *"Is this wallet dangerous or legit?"*

#### 1.1 Objective
Computes a normalized cyber-risk score $\mathcal{S} \in [0.0, 100.0]$ determining whether an address is benign, an unwitting intermediary, or an active adversary.

#### 1.2 Mathematical Formulation (Logistic Sigmoid Function)
$$\mathcal{P}(\text{Malicious} \mid \mathbf{x}) = \sigma(z) = \frac{1}{1 + e^{-z}}$$

$$\text{RiskScore}(\mathbf{x}) = 100 \times \sigma\left( \sum_{i=1}^6 w_i x_i + b \right)$$

Where:
- $\mathbf{x} = [x_{\text{mixer}}, x_{\text{peel}}, x_{\text{velocity}}, x_{\text{dust}}, x_{\text{exchange}}, x_{\text{age}}]^T$
- $\mathbf{w} = [+2.5, +1.8, +1.4, +1.6, -3.0, -1.5]^T$
- $b = -0.5$ (calibrated baseline offset)

#### 1.3 Multi-Hop Risk Attenuation Formula
When an address is downstream from a tainted source $v_0$ across hop distance $d$:
$$R_{\text{propagated}}(v) = R_0 \cdot \gamma^{d(v_0, v)}$$
Where $\gamma = 0.70$.

#### 1.4 Decision Thresholds
- **$\ge 75.0$:** `HIGH_RISK_ADVERSARIAL` (Red badge)
- **$40.0 - 74.9$:** `SUSPICIOUS_INTERMEDIARY` (Yellow badge)
- **$< 40.0$:** `LEGITIMATE_BENIGN` (Green badge)

---

### Function 2: `calculate_confidence(tx_count, volume)`
> **Question Answered:** *"Do we have enough data to trust this conclusion?"*

#### 2.1 Objective
Prevents false-positive accusations by calculating the epistemic certainty $\mathcal{C} \in [0.0, 1.0]$ based on the quantity and magnitude of observed blockchain evidence.

#### 2.2 Mathematical Formulation (Bayesian Evidence Saturation)
$$\mathcal{C}(N, V) = \left( 1 - e^{-\lambda_N \cdot N} \right) \times \left( 1 - e^{-\lambda_V \cdot V} \right)$$

Where:
- $N$: Total number of confirmed transactions associated with the wallet.
- $V$: Cumulative transacted volume (in BTC/ETH).
- $\lambda_N = 0.15$: Rate parameter for transaction count.
- $\lambda_V = 0.25$: Rate parameter for transacted volume.

#### 2.3 Sample Value Behavior
- **$N = 1$ transaction ($V = 0.05$ BTC):** $\mathcal{C} \approx 0.14 \times 0.01 = \mathbf{1.4\%}$ (Extremely Low: Insufficient History)
- **$N = 10$ transactions ($V = 5.0$ BTC):** $\mathcal{C} \approx 0.78 \times 0.71 = \mathbf{55.4\%}$ (Moderate Confidence)
- **$N \ge 35$ transactions ($V \ge 25$ BTC):** $\mathcal{C} \approx 0.99 \times 0.99 = \mathbf{98.0\%}$ (High Confidence / Defensible)

---

### Function 3: `detect_peel_chain(transaction)`
> **Question Answered:** *"Is the hacker peeling off stolen funds hop-by-hop?"*

#### 3.1 Objective
Identifies classic ransomware laundering chains where a large sum is repeatedly split into one large unspent change output and one smaller skimmed payment.

#### 3.2 Mathematical Formulation (Peel Asymmetry Metric)
For a transaction with two primary outputs $v_1$ and $v_2$:
$$\Delta_{\text{peel}} = \frac{|v_1 - v_2|}{v_1 + v_2} \in [0, 1]$$

A transaction is classified as an **Active Peel Hop** if:
$$\Delta_{\text{peel}} \ge 0.85 \quad \land \quad \text{len}(\text{vouts}) == 2 \quad \land \quad \text{out\_degree}(v_{\text{change}}) \le 1$$

#### 3.3 Gini Coefficient for Multi-Output Fanout
For transactions with $k > 2$ outputs:
$$G = \frac{\sum_{i=1}^k \sum_{j=1}^k |v_i - v_j|}{2 k^2 \bar{v}}$$
- $G \to 1.0$: High inequality (one giant change output + negligible peel cuts).

---

### Function 4: `detect_mixer_entropy(transaction)`
> **Question Answered:** *"Are they running money through a tumbler/mixer?"*

#### 4.1 Objective
Detects automated mixing protocols (e.g., Tornado Cash, CoinJoin, Wasabi) by analyzing the uniformity of output denominations.

#### 4.2 Mathematical Formulation (Normalized Shannon Entropy)
Let a transaction have $k$ outputs with amounts $\{v_1, v_2, \dots, v_k\}$.  
The probability distribution of funds is:
$$p_i = \frac{v_i}{\sum_{j=1}^k v_j}, \quad \text{where } \sum_{i=1}^k p_i = 1$$

The **Shannon Information Entropy** is:
$$H(X) = - \sum_{i=1}^{k} p_i \log_2(p_i)$$

The **Normalized Entropy Ratio** is:
$$E_{\text{norm}} = \frac{H(X)}{\log_2(k)}$$

#### 4.3 Classification Rule
- **$E_{\text{norm}} \ge 0.95 \land k \ge 4$:** **Confirmed Mixer / Tumbler Pool** (Equal-denomination anonymity set).
- **$E_{\text{norm}} < 0.60$:** Normal economic transfer or asymmetric peel chain.

---

### Function 5: `filter_dusting_attack(transaction)`
> **Question Answered:** *"Is this tiny transfer an adversarial trap?"*

#### 5.1 Objective
Detects and filters out adversarial dusting attacks sent by threat actors to trace wallet clusters or pollute forensic visualizers.

#### 5.2 Mathematical Formulation (Sub-Economic Dust Bound)
$$\text{IsDust}(T) = \begin{cases} 
\text{True}, & \text{amount}(T) \le \tau_{\text{dust}} \\
\text{False}, & \text{otherwise}
\end{cases}$$

Where:
- For Bitcoin: $\tau_{\text{dust}} = 546\text{ satoshis} = 0.00000546\text{ BTC}$ (Bitcoin Core consensus dust threshold).
- For Ethereum: $\tau_{\text{dust}} = 0.0001\text{ ETH}$.

#### 5.3 Forensic Action
- When flagged as dust: The edge is visually styled as a **gray dashed decoy line** in the UI and excluded from the main financial flow calculation to prevent distortion of balance estimates.

---

### Function 6: `detect_address_poisoning(transaction, candidate_wallet)`
> **Question Answered:** *"Is someone trying to spoof a look-alike address?"*

#### 6.1 Objective
Detects address poisoning attacks where an attacker generates a vanity address matching the first few and last few characters of a victim's legitimate contact and sends a 0-value transaction.

#### 6.2 Mathematical Formulation (Hamming & Prefix-Suffix Matching)
Let address $A$ be the victim's verified counterparty, and address $A'$ be the suspicious sender:

$$\text{PrefixMatch}(A, A') = \bigwedge_{j=1}^{4} (A[j] == A'[j])$$
$$\text{SuffixMatch}(A, A') = \bigwedge_{j=1}^{4} (A[\text{len}-j] == A'[\text{len}-j])$$

A transaction is flagged as **Address Poisoning** if:
$$\text{PrefixMatch} \land \text{SuffixMatch} \land (A \neq A') \land (\text{amount} == 0.0 \lor \text{amount} \le \tau_{\text{dust}})$$

#### 6.3 Forensic Action
- Immediately flags the transaction with `adversarial_tag = "ADDRESS_POISONING"`.
- Triggers a security alert banner on the frontend dashboard to warn the user against copying the poisoned hash.

---

## 3. Cryptographic Chain-of-Custody Recurrence

To ensure compliance with ISO/IEC 27037 digital evidence standards, every decision made by these 6 functions is recorded in the SHA-256 audit chain:

$$h_0 = \text{"0000000000000000000000000000000000000000000000000000000000000000"}$$

$$h_i = \text{SHA-256}\left( \text{JSON}_{\text{canonical}}(\text{FunctionRecord}_i) \parallel h_{i-1} \right)$$

$$\text{ValidChain} \iff \forall i \in [1, M]: h_i == \text{SHA-256}\left(\text{JSON}_{\text{canonical}}(\text{FunctionRecord}_i) \parallel h_{i-1}\right)$$
