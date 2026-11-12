import { ApiConfig, BenchmarkScenario, FlowStep, ServerHealth, TraceRequest, TraceResponse } from '../types';

const STORAGE_KEY = 'chainsentry_api_config';

export const DEFAULT_CONFIG: ApiConfig = {
  serverUrl: 'http://localhost:8001',
  serverApiKey: 'chainsentry-sec-api-key-live',
  etherscanApiKey: '',
  blockstreamApiKey: '',
};

export function getApiConfig(): ApiConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to parse api config from localStorage', e);
  }
  return DEFAULT_CONFIG;
}

export function saveApiConfig(config: ApiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save api config to localStorage', e);
  }
}

export function resetApiConfig(): ApiConfig {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_CONFIG;
}

function getHeaders(config: ApiConfig): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.serverApiKey) {
    headers['X-API-Key'] = config.serverApiKey;
    headers['Authorization'] = `Bearer ${config.serverApiKey}`;
  }
  return headers;
}

/**
 * Finds the working backend URL between port 8001 and port 8000.
 */
export async function findActiveBackendUrl(): Promise<string> {
  const candidateUrls = [
    getApiConfig().serverUrl,
    'http://localhost:8001',
    'http://localhost:8000',
  ];
  // Deduplicate
  const uniqueUrls = Array.from(new Set(candidateUrls));

  for (const url of uniqueUrls) {
    try {
      const res = await fetch(`${url}/api/v1/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.status === 'ok' || data.service?.includes('CryptoTrace'))) {
          // Update and save
          const cfg = getApiConfig();
          if (cfg.serverUrl !== url) {
            cfg.serverUrl = url;
            saveApiConfig(cfg);
          }
          return url;
        }
      }
    } catch {}
  }
  return 'http://localhost:8001';
}

/**
 * Health check that auto-detects the active port.
 */
export async function checkServerHealth(customConfig?: ApiConfig): Promise<ServerHealth> {
  const startTime = performance.now();
  const config = customConfig || getApiConfig();

  // Try configured URL
  try {
    const res = await fetch(`${config.serverUrl}/api/v1/health`, {
      headers: getHeaders(config),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.status === 'ok' || data.service?.includes('CryptoTrace'))) {
        return {
          status: 'ok',
          service: data.service || 'CryptoTrace Forensic Backend',
          version: data.version || '1.0.0',
          latencyMs: Math.round(performance.now() - startTime),
        };
      }
    }
  } catch {}

  // If custom URL not explicitly passed, probe fallback port
  if (!customConfig) {
    const fallbackUrl = config.serverUrl.includes(':8000')
      ? 'http://localhost:8001'
      : 'http://localhost:8000';
    try {
      const res = await fetch(`${fallbackUrl}/api/v1/health`, {
        headers: getHeaders(config),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.status === 'ok' || data.service?.includes('CryptoTrace'))) {
          config.serverUrl = fallbackUrl;
          saveApiConfig(config);
          return {
            status: 'ok',
            service: data.service || 'CryptoTrace Forensic Backend',
            version: data.version || '1.0.0',
            latencyMs: Math.round(performance.now() - startTime),
          };
        }
      }
    } catch {}
  }

  return {
    status: 'error',
    error: `Backend unreachable at ${config.serverUrl}. Ensure the server is running.`,
    latencyMs: Math.round(performance.now() - startTime),
  };
}

export async function fetchBenchmarks(): Promise<BenchmarkScenario[]> {
  try {
    const activeUrl = await findActiveBackendUrl();
    const config = getApiConfig();
    const res = await fetch(`${activeUrl}/api/v1/benchmarks`, {
      headers: getHeaders(config),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.scenarios)) {
        return data.scenarios;
      }
    }
  } catch {}

  return [
    {
      id: 'btc_peel_chain',
      name: 'Bitcoin Ransomware 3-Hop Peel Chain + Dusting + Poisoning',
      source_address: 'bc1q_hacker_ransomware_vault',
      currency: 'BTC',
      expected_destination: 'bc1q_binance_deposit_exchange',
      adversarial_features: ['Dusting Attack (0.00008 BTC)', 'Address Poisoning (0.0 BTC)'],
    },
    {
      id: 'eth_mixer_pool',
      name: 'Ethereum Tumbler / Mixer Fan-In Fan-Out',
      source_address: '0xHacker_Ethereum_Vault_7a1b',
      currency: 'ETH',
      mixer_contract: '0xTornado_Cash_Router_Pool_99',
      adversarial_features: ['Equal-denomination splitting', 'Temporal delay'],
    },
  ];
}

// Known sample transactions mapping for quick transaction ID lookup
export const KNOWN_TRANSACTIONS_MAP: Record<string, {
  sourceAddress: string;
  currency: string;
  description: string;
  from: string;
  to: string;
  amount: number;
}> = {
  'tx_hop1_trunk_001': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'Primary Peel Trunk: 47.9 BTC forwarded to Change Hop 1',
    from: 'bc1q_hacker_ransomware_vault',
    to: 'bc1q_change_hop1',
    amount: 47.9,
  },
  'tx_hop1_peel_002': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'Darkweb Service Payment: 2.0 BTC peeled off',
    from: 'bc1q_hacker_ransomware_vault',
    to: 'bc1q_darkweb_service',
    amount: 2.0,
  },
  'tx_hop1_dust_003': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'Dusting Attack Decoy: 0.00008 BTC sent to innocent address',
    from: 'bc1q_hacker_ransomware_vault',
    to: 'bc1q_innocent_dusting_victim',
    amount: 0.00008,
  },
  'tx_hop1_poison_004': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'Address Poisoning Decoy: 0.0 BTC to lookalike spoofed address',
    from: 'bc1q_hacker_ransomware_vault',
    to: 'bc1q_lookalike_spoofed_victim',
    amount: 0.0,
  },
  'tx_hop2_trunk_005': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'Hop 2 Peel Trunk: 44.5 BTC to Change Hop 2',
    from: 'bc1q_change_hop1',
    to: 'bc1q_change_hop2',
    amount: 44.5,
  },
  'tx_hop2_peel_006': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'P2P Broker Peel: 3.399 BTC payment',
    from: 'bc1q_change_hop1',
    to: 'bc1q_p2p_broker_peel',
    amount: 3.399,
  },
  'tx_hop3_cashout_007': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'Cash-out Exit: 40.0 BTC deposited into Binance Deposit Exchange',
    from: 'bc1q_change_hop2',
    to: 'bc1q_binance_deposit_exchange',
    amount: 40.0,
  },
  'tx_hop3_trunk_008': {
    sourceAddress: 'bc1q_hacker_ransomware_vault',
    currency: 'BTC',
    description: 'Remaining Change: 4.499 BTC to Change Hop 3',
    from: 'bc1q_change_hop2',
    to: 'bc1q_change_hop3',
    amount: 4.499,
  },
  '0xeth_tx_01': {
    sourceAddress: '0xHacker_Ethereum_Vault_7a1b',
    currency: 'ETH',
    description: 'Mixer Pool Deposit: 10.0 ETH sent into Tornado Cash Pool',
    from: '0xHacker_Ethereum_Vault_7a1b',
    to: '0xTornado_Cash_Router_Pool_99',
    amount: 10.0,
  },
  '0xeth_tx_02': {
    sourceAddress: '0xHacker_Ethereum_Vault_7a1b',
    currency: 'ETH',
    description: 'Second Mixer Deposit: 10.0 ETH into Tornado Cash Pool',
    from: '0xHacker_Ethereum_Vault_7a1b',
    to: '0xTornado_Cash_Router_Pool_99',
    amount: 10.0,
  },
  '0xeth_tx_03': {
    sourceAddress: '0xHacker_Ethereum_Vault_7a1b',
    currency: 'ETH',
    description: 'Mixer Payout: 9.95 ETH withdrawn to Clean Recipient Alpha',
    from: '0xTornado_Cash_Router_Pool_99',
    to: '0xRecipient_Clean_Alpha_11',
    amount: 9.95,
  },
  '0xeth_tx_04': {
    sourceAddress: '0xHacker_Ethereum_Vault_7a1b',
    currency: 'ETH',
    description: 'Mixer Payout: 9.95 ETH withdrawn to Clean Recipient Beta',
    from: '0xTornado_Cash_Router_Pool_99',
    to: '0xRecipient_Clean_Beta_22',
    amount: 9.95,
  },
};

export async function resolveInput(input: string): Promise<{
  resolvedAddress: string;
  initialTxHash?: string;
  currency: 'BTC' | 'ETH';
  description?: string;
  isTxId: boolean;
}> {
  const trimmed = input.trim();

  // 1. Direct match in sample transactions
  if (KNOWN_TRANSACTIONS_MAP[trimmed]) {
    const item = KNOWN_TRANSACTIONS_MAP[trimmed];
    return {
      resolvedAddress: item.sourceAddress,
      initialTxHash: trimmed,
      currency: item.currency as 'BTC' | 'ETH',
      description: item.description,
      isTxId: true,
    };
  }

  // 2. Case-insensitive lookup
  const lower = trimmed.toLowerCase();
  for (const [key, item] of Object.entries(KNOWN_TRANSACTIONS_MAP)) {
    if (key.toLowerCase() === lower) {
      return {
        resolvedAddress: item.sourceAddress,
        initialTxHash: key,
        currency: item.currency as 'BTC' | 'ETH',
        description: item.description,
        isTxId: true,
      };
    }
  }

  // Detect currency from prefix
  const isEth = trimmed.startsWith('0x') || trimmed.toLowerCase().includes('eth');
  const currency: 'BTC' | 'ETH' = isEth ? 'ETH' : 'BTC';

  return {
    resolvedAddress: trimmed,
    currency,
    isTxId: false,
  };
}

export async function traceAddress(request: TraceRequest): Promise<TraceResponse> {
  const activeUrl = await findActiveBackendUrl();
  const config = getApiConfig();

  const res = await fetch(`${activeUrl}/api/v1/trace`, {
    method: 'POST',
    headers: getHeaders(config),
    body: JSON.stringify({
      target_address: request.target_address,
      max_hops: request.max_hops ?? 3,
      currency: request.currency ?? 'BTC',
      min_amount_threshold: request.min_amount_threshold ?? 0.0,
      generate_viz: request.generate_viz ?? true,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail || errorText;
    } catch {}
    throw new Error(detail || `Trace request failed with status ${res.status}`);
  }

  return await res.json();
}

export function generateFlowSteps(trace: TraceResponse): FlowStep[] {
  const steps: FlowStep[] = [];
  const nodeMap = new Map<string, number>();

  for (const n of trace.nodes) {
    nodeMap.set(n.address, n.hop_distance ?? (n.is_source ? 0 : 1));
  }

  const txs = [...trace.transactions];
  txs.sort((a, b) => {
    const hopA = nodeMap.get(a.from_address) ?? 0;
    const hopB = nodeMap.get(b.from_address) ?? 0;
    if (hopA !== hopB) return hopA - hopB;
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.is_adversarial && !b.is_adversarial) return 1;
    if (!a.is_adversarial && b.is_adversarial) return -1;
    return b.amount - a.amount;
  });

  let stepIdx = 1;
  for (const tx of txs) {
    const fromHop = nodeMap.get(tx.from_address) ?? 0;
    const toHop = nodeMap.get(tx.to_address) ?? fromHop + 1;

    let role: FlowStep['flowRole'] = 'source_trunk';
    let narrative = '';

    if (tx.is_adversarial) {
      if (tx.adversarial_tag?.includes('DUST')) {
        role = 'dusting';
        narrative = `⚠️ Dusting Attack: Sent tiny decoy amount (${tx.amount} ${tx.currency}) to ${shortenAddr(tx.to_address)}`;
      } else {
        role = 'poisoning';
        narrative = `⚠️ Address Poisoning: Generated 0.0 ${tx.currency} spoofing transaction to ${shortenAddr(tx.to_address)}`;
      }
    } else if (
      tx.to_address.toLowerCase().includes('exchange') ||
      tx.to_address.toLowerCase().includes('binance') ||
      trace.end_receivers.some((r) => r.address === tx.to_address && r.is_sink)
    ) {
      role = 'cashout';
      narrative = `🎯 Cash-Out Realized: Transferred ${tx.amount} ${tx.currency} into exit sink ${shortenAddr(tx.to_address)}`;
    } else if (tx.to_address.toLowerCase().includes('mixer') || tx.from_address.toLowerCase().includes('mixer')) {
      if (tx.from_address.toLowerCase().includes('mixer')) {
        role = 'mixer_payout';
        narrative = `🌪️ Mixer Payout: Anonymized withdrawal of ${tx.amount} ${tx.currency} to ${shortenAddr(tx.to_address)}`;
      } else {
        role = 'mixer_deposit';
        narrative = `🌪️ Mixer Pool Injection: Sent ${tx.amount} ${tx.currency} into privacy pool ${shortenAddr(tx.to_address)}`;
      }
    } else {
      role = fromHop === 0 ? 'source_trunk' : 'peel';
      narrative = `Forwarded ${tx.amount} ${tx.currency} from ${shortenAddr(tx.from_address)} to ${shortenAddr(tx.to_address)}`;
    }

    steps.push({
      stepNumber: stepIdx++,
      hop: toHop,
      txHash: tx.tx_hash,
      fromAddress: tx.from_address,
      toAddress: tx.to_address,
      amount: tx.amount,
      currency: tx.currency,
      fee: tx.fee,
      timestamp: tx.timestamp,
      isAdversarial: tx.is_adversarial,
      adversarialTag: tx.adversarial_tag,
      description: narrative,
      flowRole: role,
    });
  }

  return steps;
}

export function shortenAddr(addr: string, chars = 6): string {
  if (!addr) return '';
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function formatCrypto(val: number, currency: string = 'BTC'): string {
  if (val === 0) return `0.00 ${currency}`;
  if (val < 0.0001) return `${val.toFixed(8)} ${currency}`;
  return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${currency}`;
}
