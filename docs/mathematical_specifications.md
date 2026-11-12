# CryptoTrace — Mathematical, Probabilistic & Algorithmic Framework

This document outlines the formal mathematical formulations, probabilistic models, and algorithmic metrics implemented in **CryptoTrace** for confidence-aware blockchain forensics, risk assessment, and adversarial transaction detection.

---

## 1. Multi-Hop Risk Propagation & Exponential Distance Decay

In forensic tracing, an address's proximity to a confirmed threat actor (e.g., ransomware drainer, sanctioned wallet, darknet vendor) determines its tainted exposure. However, risk diminishes exponentially as funds travel through subsequent intermediary hops.

### 1.1 Exponential Attenuation Formula
For a single linear path from an adversary source node $v_0$ with initial threat risk $R_0 \in [0, 100]$ to a descendant node $v$ across hop distance $d(v_0, v) \in \mathbb{N}$:

$$R(v) = R_0 \cdot \gamma^{d(v_0, v)}$$

Where:
- $\gamma \in (0, 1)$ is the **Forensic Attenuation Factor** (default: $\gamma = 0.70$).
- $d(v_0, v)$ is the shortest path length (in hops) from $v_0$ to $v$.

| Hop Distance ($d$) | Attenuation Factor ($\gamma = 0.70$) | Effective Risk (from $R_0 = 100$) | Forensic Interpretation |
| :---: | :---: | :---: | :--- |
| **0** | $0.70^0 = 1.00$ | **$100.0$** | Confirmed Suspicious Source / Threat Actor |
| **1** | $0.70^1 = 0.70$ | **$70.0$** | Primary Direct Recipient / Immediate Accomplice |
| **2** | $0.70^2 = 0.49$ | **$49.0$** | Secondary Intermediary / Peel-Chain Node |
| **3** | $0.70^3 = 0.343$ | **$34.3$** | Distanced Recipient / Terminal Sink |

### 1.2 Multi-Path Risk Aggregation (Noisy-OR Formulation)
When a destination node $v$ receives funds through multiple converging paths $\mathcal{P} = \{p_1, p_2, \dots, p_k\}$ originating from distinct tainted sources, the cumulative exposure probability is aggregated using the **Noisy-OR probabilistic model**:

$$R_{\text{agg}}(v) = 100 \times \left( 1 - \prod_{p \in \mathcal{P}} \left( 1 - \frac{R(p)}{100} \cdot \omega_p \right) \right)$$

Where $\omega_p = \frac{\text{Volume}_p}{\text{TotalVolume}_v} \in [0, 1]$ represents the normalized volume weight delivered along path $p$.

---

## 2. Logistic Sigmoid Risk Classification Function

To map heterogeneous forensic features (peel ratios, mixer exposure, transaction velocity, dust interactions, wallet lifespan) into a normalized risk score $\mathcal{S} \in [0, 100]$, we employ a parameterized **Logistic Sigmoid Function**.

### 2.1 Formulation

$$\mathcal{P}(\text{Malicious} \mid \mathbf{x}) = \sigma(z) = \frac{1}{1 + e^{-z}}$$

$$\text{RiskScore}(\mathbf{x}) = 100 \times \sigma\left( \mathbf{w}^T \mathbf{x} + b \right)$$

Where:
- $\mathbf{x} = [x_1, x_2, x_3, x_4, x_5, x_6]^T$ is the normalized feature vector.
- $\mathbf{w} = [w_1, w_2, w_3, w_4, w_5, w_6]^T$ is the empirical feature weight vector.
- $b$ is the calibrated bias offset.

### 2.2 Feature Vector Definition ($\mathbf{x}$)

| Feature ($x_i$) | Formulation / Definition | Weight ($w_i$) | Impact |
| :--- | :--- | :---: | :--- |
| **$x_1$: Mixer Proximity** | Direct ($1.0$) or indirect ($0.5$) exposure to mixer pools | $+2.5$ | Increases risk |
| **$x_2$: Peel Asymmetry** | $\Delta_{\text{peel}} \in [0, 1]$ (asymmetric change vs payment) | $+1.8$ | Increases risk |
| **$x_3$: Velocity of Dissipation** | Transfer velocity $\mathcal{V} = \frac{\text{Vol}}{\Delta t_{\text{blocks}}}$ | $+1.4$ | Increases risk |
| **$x_4$: Adversarial Traps** | Exposure to sub-economic dusting or poisoning transfers | $+1.6$ | Increases risk |
| **$x_5$: Regulated Entity** | Indicator $\mathbb{I}_{\text{exchange}} \in \{0, 1\}$ (Binance, Coinbase) | $-3.0$ | Lowers risk |
| **$x_6$: Wallet Age** | $\log_{10}(1 + \text{ActiveDays})$ | $-1.5$ | Lowers risk |

### 2.3 Classification Decision Boundaries
$$\text{Class}(\mathbf{x}) = \begin{cases} 
\text{HIGH\_RISK\_ADVERSARIAL}, & \text{RiskScore} \ge 75.0 \\
\text{SUSPICIOUS\_INTERMEDIARY}, & 40.0 \le \text{RiskScore} < 75.0 \\
\text{LEGITIMATE\_BENIGN}, & \text{RiskScore} < 40.0 
\end{cases}$$

---

## 3. Shannon Information Entropy (Mixer & Tumbler Detection)

Obfuscation tumblers (such as Tornado Cash or CoinJoin implementations) split incoming funds into uniform, equal denominations to maximize the anonymity set and frustrate graph matching algorithms.

### 3.1 Shannon Entropy of Output Denominations
Let a transaction $T$ have $k$ outgoing outputs with amounts $\{v_1, v_2, \dots, v_k\}$.  
The discrete probability mass function $p_i$ of value distribution is defined as:

$$p_i = \frac{v_i}{\sum_{j=1}^{k} v_j}, \quad \text{where } \sum_{i=1}^k p_i = 1$$

The **Shannon Information Entropy** $H(X)$ is computed as:

$$H(X) = - \sum_{i=1}^{k} p_i \log_2(p_i)$$

### 3.2 Normalized Entropy Ratio ($E_{\text{norm}}$)
To compare transactions regardless of output count $k$, we normalize by the theoretical maximum entropy $H_{\max} = \log_2(k)$:

$$E_{\text{norm}} = \frac{H(X)}{\log_2(k)} \in [0, 1]$$

#### Forensic Interpretations:
1. **$E_{\text{norm}} \to 1.0$ (Maximum Entropy):**
   - All outputs are identically sized ($v_1 = v_2 = \dots = v_k$).
   - **Conclusion:** Equal-denomination Tumbler / Mixing Pool pattern detected.
2. **$E_{\text{norm}} \ll 0.5$ (Low Entropy / Asymmetric):**
   - One dominant output holds $>90\%$ of funds (change), while a small fraction is peeled.
   - **Conclusion:** Peel-Chain transaction pattern detected.

---

## 4. Peel-Chain Asymmetry Metric & Gini Coefficient

A **Peel Chain** is a classic money-laundering heuristic where a large lump sum is progressively "peeled" across a sequence of addresses, with one output returning the vast majority of funds as change to a new burner wallet, while a smaller cut is skimmed or deposited.

### 4.1 Peel Asymmetry Index ($\Delta_{\text{peel}}$)
For a 2-output transaction with outputs $v_1$ (change candidate) and $v_2$ (peeled cut):

$$\Delta_{\text{peel}} = \frac{|v_1 - v_2|}{v_1 + v_2} \in [0, 1]$$

- **$\Delta_{\text{peel}} \ge 0.85$:** Indicates a classic peel pattern (e.g., $95\%$ change, $5\%$ peeled).
- **$\Delta_{\text{peel}} \approx 0.00$:** Indicates balanced splitting (potential 50/50 mixer branch).

### 4.2 Gini Coefficient of Fanout Distribution
When an address fans out to $k$ recipients, we calculate the Gini inequality coefficient $G$:

$$G = \frac{\sum_{i=1}^k \sum_{j=1}^k |v_i - v_j|}{2 k^2 \bar{v}}$$

Where $\bar{v}$ is the mean output transfer amount.
- High $G \to 1.0$: High inequality (one giant change output + tiny dust outputs).
- Low $G \to 0.0$: Perfect equality (mixer pool batch payout).

---

## 5. Bayesian Confidence Scoring (Sample Evidence Saturation)

A risk score cannot be trusted without a quantification of **investigative confidence**. A wallet observed across 1 single transfer possesses high epistemic uncertainty, whereas an address evaluated across 200 confirmed historical transactions provides high empirical certainty.

### 5.1 Dual-Variable Evidence Saturation Function
Confidence $\mathcal{C} \in [0.0, 1.0]$ is formulated as a saturating joint exponential distribution over transaction volume count $N$ and cumulative value volume $V$:

$$\mathcal{C}(N, V) = \left( 1 - e^{-\lambda_N \cdot N} \right) \times \left( 1 - e^{-\lambda_V \cdot V} \right)$$

Where:
- $N$ is the number of confirmed transactions associated with the entity.
- $V$ is the total volume processed (in native coin, BTC/ETH).
- $\lambda_N = 0.15$ (transaction count rate parameter).
- $\lambda_V = 0.25$ (value volume rate parameter).

```
Confidence Curve C(N) vs Transaction Count:
1.00 ┤                                  ╭─────────── (Saturation limit)
0.80 ┤                         ╭────────╯
0.60 ┤                ╭────────╯
0.40 ┤        ╭───────╯
0.20 ┤   ╭────╯
0.00 ┼───┴────────┴────────┴────────┴────────┴─────────►
     0   5       10       15       20       25 (N txs)
```

---

## 6. Cryptographic Hash-Chain Integrity Recurrence

To ensure tamper-evidence compliant with ISO/IEC 27037 forensic evidence standards, the audit trail operates as an append-only, SHA-256 authenticated hash chain.

### 6.1 Mathematical Recurrence Relation
Let the sequence of forensic investigation events be denoted by $S_1, S_2, \dots, S_M$.  
The hash sequence $\{h_i\}_{i=0}^M$ is defined inductively:

$$h_0 = 0^{64} = \text{"0000000000000000000000000000000000000000000000000000000000000000"}$$

$$h_i = \mathcal{H}_{\text{SHA-256}}\left( \text{JSON}_{\text{canonical}}(S_i) \parallel h_{i-1} \right), \quad \forall i \in \{1, 2, \dots, M\}$$

Where:
- $\parallel$ denotes string concatenation.
- $\text{JSON}_{\text{canonical}}(\cdot)$ enforces deterministic lexicographical key sorting and whitespace stripping.
- $\mathcal{H}_{\text{SHA-256}}(\cdot)$ produces a 256-bit hexadecimal digest.

### 6.2 Tamper Verification Theorem
The entire forensic chain of custody is provably authentic if and only if:

$$\text{ChainIntegrity} \iff \bigwedge_{i=1}^{M} \left[ h_i == \mathcal{H}_{\text{SHA-256}}\left( \text{JSON}_{\text{canonical}}(S_i) \parallel h_{i-1} \right) \right]$$

If an adversary modifies any historical record $S_k^*$ ($k \le M$):
$$\mathcal{H}_{\text{SHA-256}}(S_k^* \parallel h_{k-1}) \neq h_k \implies \text{Verification fails at step } k.$$

---

## 7. Forensic Stopping Criteria Matrix

The recursive multi-hop graph traversal terminates a search path when any of the four formal boundary conditions are met:

$$\text{Stop}(\text{node } v, \text{hop } h, \text{amount } a) = \begin{cases}
\text{TERMINAL\_CASHOUT}, & \text{if } \mathbb{I}_{\text{exchange}}(v) = 1 \\
\text{MIXER\_TUMBLER\_POOL}, & \text{if } \mathbb{I}_{\text{mixer}}(v) = 1 \\
\text{COLD\_STORAGE\_SINK}, & \text{if } \text{deg}^{+}(v) = 0 \\
\text{MAX\_DEPTH\_BOUNDARY}, & \text{if } h \ge \text{MaxHops} \\
\text{DILUTION\_PRUNED}, & \text{if } a < \tau_{\min}
\end{cases}$$

Where $\text{deg}^{+}(v)$ is the out-degree of address $v$, and $\tau_{\min}$ is the user-defined `min_amount_threshold`.
