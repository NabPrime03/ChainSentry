# CryptoTrace — Mathematical, Probabilistic & Forensic Function Framework

This document outlines the formal mathematical formulations, probabilistic models, and algorithmic function specifications implemented in **CryptoTrace** for confidence-aware blockchain forensics, risk classification, and adversarial transaction detection.

> [!NOTE]
> For the comprehensive checklist of all 14 real-world vulnerabilities, attack vectors, and their live implementation tracking status, see [Forensic Problems & Solution Tracker](file:///home/nab/hackathon/cryptotrace/docs/forensic_problems_and_solutions.md).

---

## 1. Executive Function Reference Matrix

| # | Function Identifier | Primary Forensic Question | Mathematical / Algorithmic Model | Solved Problems |
| :---: | :--- | :--- | :--- | :---: |
| **1** | `calculate_risk_score()` | *"Is this wallet dangerous or legit?"* | Logistic Sigmoid ($\sigma(z)$) + Value-Preserving Taint Attenuation ($R_0[\alpha + (1-\alpha)\gamma^{h_{\text{eff}}}]$) | #2, #3, #7, #13 |
| **2** | `calculate_confidence()` | *"Do we have enough data to trust this conclusion?"* | Bayesian Evidence Saturation ($\mathcal{C}(N, V) = (1 - e^{-\lambda_N N})(1 - e^{-\lambda_V V})$) | #12 |
| **3** | `detect_peel_chain()` | *"Is the hacker peeling off stolen funds hop-by-hop?"* | Asymmetry Metric ($\Delta_{\text{peel}} \ge 0.85$) + Gini Coefficient ($G$) | #8 |
| **4** | `detect_mixer_entropy()` | *"Are they running money through a tumbler/mixer?"* | Shannon Information Entropy ($H(X)$) & Normalized Entropy ($E_{\text{norm}}$) | #11 |
| **5** | `filter_dusting_attack()` | *"Is this tiny transfer an adversarial trap?"* | Sub-economic UTXO threshold filter ($\le 546\text{ satoshis}$) | #1, #9 |
| **6** | `detect_address_poisoning()`| *"Is someone trying to spoof a look-alike address?"* | Hamming/Prefix-Suffix Match ($L_{\text{prefix}} \ge 4 \land L_{\text{suffix}} \ge 4$) + 0-value check | #10 |
| **7** | `crawl_multihop_transactions()`| *"How do we traverse the graph without exploding or looping?"* | Shortest-Path DAG Constraint, Visited Set Cycle Prevention, Top-25 Fanout Sorting | #1, #5 |
| **8** | `cluster_recombination()` | *"Are multiple micro-mules recombining into one owner?"* | Common-Input Ownership Clustering Heuristic ($\bigcup \text{Inputs} \implies \text{Single Entity}$) | #4 |
| **9** | `evaluate_stopping_condition()`| *"When must tracing stop to protect innocent people?"* | Boundary State Machine ($\mathbb{I}_{\text{exchange}}, \mathbb{I}_{\text{mixer}}, \mathbb{I}_{\text{bridge}}, \text{deg}^{+}(v) == 0$) | #6, #14 |

---

## 2. Deep Dive: Core Forensic Functions & Mathematical Formulations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CRYPTOTRACE FORENSIC PIPELINE                            │
│                                                                             │
│  [ Raw Blockchain Transaction Stream ]                                      │
│          │                                                                  │
│          ├──► crawl_multihop_transactions()   (Pruning + Cycle Prevention)  │
│          ├──► evaluate_stopping_condition()   (Exchange & Bridge Cutoff)    │
│          ├──► filter_dusting_attack()         (Prunes sub-economic traps)   │
│          ├──► detect_address_poisoning()      (Catches vanity spoofers)     │
│          ├──► detect_peel_chain()             (Flags asymmetric laundering) │
│          ├──► detect_mixer_entropy()          (Flags equal-slice tumblers)  │
│          ├──► cluster_recombination()         (Merges micro-mule co-spends) │
│          │                                                                  │
│          ▼                                                                  │
│  [ Feature Aggregation Vector x ]                                           │
│          │                                                                  │
│          ├──► calculate_risk_score(x)         (Sigmoid Threat Score 0-100)  │
│          └──► calculate_confidence(N, V)      (Bayesian Certainty 0-100%)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Function 1: `calculate_risk_score(address_node, graph, source_volume)`
> **Questions Answered:** *"Is this wallet dangerous or legit?"* (Solves Problems #2, #3, #7, #13)

#### 1.1 Objective
Computes a normalized cyber-risk score $\mathcal{S} \in [0.0, 100.0]$ determining whether an address is benign, an unwitting intermediary, or an active adversary.

#### 1.2 Mathematical Formulation (Logistic Sigmoid Function)
$$\mathcal{P}(\text{Malicious} \mid \mathbf{x}) = \sigma(z) = \frac{1}{1 + e^{-z}}$$

$$\text{RiskScore}(\mathbf{x}) = 100 \times \sigma\left( \sum_{i=1}^6 w_i x_i + b \right)$$

Where:
- $\mathbf{x} = [x_{\text{mixer}}, x_{\text{peel}}, x_{\text{velocity}}, x_{\text{dust}}, x_{\text{exchange}}, x_{\text{age}}]^T$
- $\mathbf{w} = [+2.5, +1.8, +1.4, +1.6, -3.0, -1.5]^T$
- $b = -0.5$ (calibrated baseline offset)

#### 1.3 Value-Preserving Multi-Hop Risk Attenuation (With Taint Ratio $\alpha$)
A naive distance decay ($R_0 \cdot \gamma^{\text{hop}}$) creates a critical forensic vulnerability: an adversary could wash their threat score down to $16.8\%$ simply by relaying funds through 5 burner wallets. 

To eliminate this flaw, CryptoTrace introduces the **Taint Volume Ratio $\alpha(v)$**, blending the percentage of the original stolen loot held by the wallet with distance attenuation:

$$\alpha(v) = \frac{\text{Stolen Amount Reaching Wallet } v}{\text{Total Stolen Amount Source Volume}} \in [0.0, 1.0]$$

The **Value-Preserving Propagated Risk Formula** is:

$$R_{\text{propagated}}(v) = R_0 \cdot \left[ \underbrace{\alpha(v)}_{\text{Taint Value Preservation}} + \big(1 - \alpha(v)\big) \cdot \underbrace{\gamma^{\text{hop}_{\text{eff}}(v)}}_{\text{Distance Attenuation}} \right]$$

Where:
- $R_0 = 100$: Source adversary risk.
- $\gamma = 0.70$: Attenuation decay factor for non-loot side payments.
- $\text{hop}_{\text{eff}}(v)$ is the **Effective Hop Distance**, incorporating **Conduit Pass-Through Freezing** and **Multi-Trunk Dominance**:

$$\text{hop}_{\text{eff}}(v) = \begin{cases}
1, & \text{if } \alpha(v) \ge \tau_{\text{trunk}} \quad (\text{Single Heavy Trunk Freeze, } \ge 70\%) \\
1, & \text{if } \alpha(v) \ge 0.20 \land v \in \text{Top-3 Outputs} \quad (\text{Multi-Trunk Split / Smurfing Freeze}) \\
\text{hop}(v), & \text{otherwise (Standard side-payment decay for small decoys)}
\end{cases}$$

Where $\tau_{\text{trunk}} = 0.70$ ($70\%$ loot threshold).

##### 1.3.1 Intuition: Physical Hop vs. Effective Hop (The "Left Pocket to Right Pocket" Principle)
A critical insight in blockchain forensics is distinguishing between an actual transfer to an outside counterparty versus an adversary moving funds from their **"left pocket to their right pocket"**:
- **Physical Hop:** Measures raw network traversal distance (how many intermediate wallets the coins touched).
- **Effective Hop ($\text{hop}_{\text{eff}}$):** Freezes at $1$ as long as an entity holds $\ge 70\%$ of the stolen loot bag ($\alpha \ge \tau_{\text{trunk}}$) or is a major sub-trunk ($\ge 20\%$ Top-3 output), preventing an adversary from washing risk away through internal pass-through conduits.

```
[HACKER: 100 BTC] (Hop 0)
       │
       ├──────────────────────────────────────────► [Hosting Company: 2 BTC]
       ▼
 [Burner Wallet 1: 98 BTC] (Physical Hop 1)
       │
       ├──────────────────────────────────────────► [Laptop Shop: 2 BTC]
       ▼
 [Burner Wallet 2: 96 BTC] (Physical Hop 2)
       │
       ├──────────────────────────────────────────► [Grocery Store: 2 BTC]
       ▼
 [Final Vault: 94 BTC] (Physical Hop 3)
```

##### 1.3.2 Concrete Comparative Evaluation Table:

| Wallet Entity | Amount Held | Loot Share ($\alpha$) | Physical Hop | Effective Hop ($\text{hop}_{\text{eff}}$) | Calculated Risk Score | Forensic Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Burner Wallet 1** | $98\text{ BTC}$ | $98\%$ ($\ge 70\%$) | Hop 1 | **$1$ (Frozen)** | **$98.6\%$** | 🔴 **HIGH RISK** (Adversary Mule) |
| **Burner Wallet 2** | $96\text{ BTC}$ | $96\%$ ($\ge 70\%$) | Hop 2 | **$1$ (Frozen!)** | **$97.2\%$** | 🔴 **HIGH RISK** (Adversary Mule) |
| **Final Loot Vault** | $94\text{ BTC}$ | $94\%$ ($\ge 70\%$) | Hop 3 | **$1$ (Frozen!)** | **$95.8\%$** | 🔴 **CRITICAL THREAT** (Primary Loot Sink) |
| **Multi-Mule Split A** | $45\text{ BTC}$ | $45\%$ ($\ge 20\%$) | Hop 3 | **$1$ (Frozen!)** | **$83.5\%$** | 🔴 **HIGH RISK** (Sub-Trunk Mule) |
| **Grocery Store** | $2\text{ BTC}$ | $2\%$ ($< 20\%$) | Hop 3 | **$3$ (Normal decay)** | **$34.5\%$** | 🟢 **BENIGN** (Protected Innocent Merchant) |

#### 1.4 Decision Thresholds
- **$\ge 75.0$:** `HIGH_RISK_ADVERSARIAL` (Red badge)
- **$40.0 - 74.9$:** `SUSPICIOUS_INTERMEDIARY` (Yellow badge)
- **$< 40.0$:** `LEGITIMATE_BENIGN` (Green badge)

---

### Function 2: `calculate_confidence(tx_count, volume)`
> **Question Answered:** *"Do we have enough data to trust this conclusion?"* (Solves Problem #12)

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
> **Question Answered:** *"Is the hacker peeling off stolen funds hop-by-hop?"* (Solves Problem #8)

#### 3.1 Objective
Identifies classic ransomware laundering chains where a large sum is repeatedly split into one large unspent change output and one smaller skimmed payment.

#### 3.2 Mathematical Formulation (Peel Asymmetry Metric)
For a transaction with two primary outputs $v_1$ and $v_2$:
$$\Delta_{\text{peel}} = \frac{|v_1 - v_2|}{v_1 + v_2} \in [0, 1]$$

A transaction is classified as an **Active Peel Hop** if:
$$\Delta_{\text{peel}} \ge 0.85 \quad \land \quad \text{len}(\text{vouts}) == 2 \quad \land \quad \text{out\_degree}(v_{\text{change}}) \le 1$$

---

### Function 4: `detect_mixer_entropy(transaction)`
> **Question Answered:** *"Are they running money through a tumbler/mixer?"* (Solves Problem #11)

#### 4.1 Objective
Detects automated mixing protocols (e.g., Wasabi, Tornado Cash, Whirlpool) by analyzing the uniformity of output denominations.

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

### Function 5: `filter_dusting_attack(transaction, threshold_sats)`
> **Question Answered:** *"Is this tiny transfer an adversarial trap?"* (Solves Problems #1, #9)

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

---

### Function 6: `detect_address_poisoning(transaction, candidate_wallet)`
> **Question Answered:** *"Is someone trying to spoof a look-alike address?"* (Solves Problem #10)

#### 6.1 Objective
Detects address poisoning attacks where an attacker generates a vanity address matching the first few and last few characters of a victim's legitimate contact and sends a 0-value transaction.

#### 6.2 Mathematical Formulation (Hamming & Prefix-Suffix Matching)
Let address $A$ be the victim's verified counterparty, and address $A'$ be the suspicious sender:

$$\text{PrefixMatch}(A, A') = \bigwedge_{j=1}^{4} (A[j] == A'[j])$$
$$\text{SuffixMatch}(A, A') = \bigwedge_{j=1}^{4} (A[\text{len}-j] == A'[\text{len}-j])$$

A transaction is flagged as **Address Poisoning** if:
$$\text{PrefixMatch} \land \text{SuffixMatch} \land (A \neq A') \land (\text{amount} == 0.0 \lor \text{amount} \le \tau_{\text{dust}})$$

---

### Function 7: `crawl_multihop_transactions()`
> **Question Answered:** *"How do we traverse the graph without exploding memory or looping?"* (Solves Problems #1, #5)

#### 7.1 Objective
Provides a bounded, memory-efficient multi-hop BFS discovery crawler that prevents exponential graph explosion ($O(b^d)$) and wash-trading cyclic infinite loops.

#### 7.2 Algorithmic Formulation
1. **Cycle Prevention via Shortest-Path DAG:** Maintains a global set $\mathcal{V}_{\text{visited}}$. If address $u \in \mathcal{V}_{\text{visited}}$, downstream edges are skipped, converting cyclic flows into a Directed Acyclic Graph (DAG).
2. **Top-$K$ Output Fanout Bounding:** For transactions with fanout $M > K$ (e.g. mining pool batch $M = 5,000$), outputs are ranked by satoshi volume:
   $$\text{RankedOutputs} = \text{SortDescending}(\{v_1, \dots, v_M\})[1 \dots K] \quad \text{where } K = 25$$
   Prunes sub-economic outputs ($v_i \le \tau_{\text{dust}}$) prior to recursive descent.

---

### Function 8: `cluster_recombination(transactions)`
> **Question Answered:** *"Are multiple micro-mules recombining into one owner?"* (Solves Problem #4)

#### 8.1 Objective
Neutralizes micro-splitting attacks where an adversary divides funds into $50+$ tiny accounts to bypass branch thresholds, then later combines them to spend or deposit.

#### 8.2 Mathematical Formulation (Common-Input Ownership Heuristic)
If a transaction $T_k$ has inputs $\mathcal{I}(T_k) = \{u_1, u_2, \dots, u_m\}$:
$$\forall u_a, u_b \in \mathcal{I}(T_k), \quad \text{Cluster}(u_a) \equiv \text{Cluster}(u_b)$$

The effective taint of the recombined cluster $\mathcal{C}$ is the sum of its micro-mule taints:
$$\alpha(\mathcal{C}) = \sum_{u_i \in \mathcal{C}} \alpha(u_i)$$
When $\alpha(\mathcal{C}) \ge 0.20$, the cluster is restored to high-threat status.

---

### Function 9: `evaluate_stopping_condition(address, metadata)`
> **Question Answered:** *"When must tracing stop to protect innocent people and handle boundaries?"* (Solves Problems #6, #14)

#### 9.1 Objective
Prevents the "Dirty Drop in the Ocean" vulnerability (where tracing through high-volume exchange hot wallets taints thousands of innocent withdrawers) and flags cross-chain exits.

#### 9.2 State Machine Formulation
At every traversed node $v$, evaluate the stopping predicate $\mathcal{S}(v) \in \{\text{CONTINUE}, \text{HALT}\}$:

$$\mathcal{S}(v) = \begin{cases}
\text{HALT (TERMINAL\_EXCHANGE\_CASH\_OUT)}, & \text{if } \mathbb{I}_{\text{exchange}}(v) == 1 \\
\text{HALT (TERMINAL\_MIXER\_POOL)}, & \text{if } \mathbb{I}_{\text{mixer}}(v) == 1 \\
\text{HALT (TERMINAL\_CROSS\_CHAIN\_BRIDGE)}, & \text{if } \mathbb{I}_{\text{bridge}}(v) == 1 \\
\text{HALT (COLD\_STORAGE\_VAULT)}, & \text{if } \text{deg}^{+}(v) == 0 \\
\text{CONTINUE}, & \text{otherwise}
\end{cases}$$

---

## 3. Cryptographic Chain-of-Custody Recurrence

To ensure compliance with ISO/IEC 27037 digital evidence standards, every decision made across these **9 forensic functions** is recorded in the SHA-256 audit chain:

$$h_0 = \text{"0000000000000000000000000000000000000000000000000000000000000000"}$$

$$h_i = \text{SHA-256}\left( \text{JSON}_{\text{canonical}}(\text{FunctionRecord}_i) \parallel h_{i-1} \right)$$

$$\text{ValidChain} \iff \forall i \in [1, M]: h_i == \text{SHA-256}\left(\text{JSON}_{\text{canonical}}(\text{FunctionRecord}_i) \parallel h_{i-1}\right)$$
