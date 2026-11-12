export interface Transaction {
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  currency: string;
  timestamp: number;
  fee?: number;
  block_number?: number | null;
  is_adversarial?: boolean;
  adversarial_tag?: string | null;
}

export interface AddressNode {
  address: string;
  in_degree: number;
  out_degree: number;
  total_received: number;
  total_sent: number;
  balance_estimate: number;
  tags: string[];
  is_source: boolean;
  hop_distance?: number | null;
}

export interface EndReceiverSummary {
  address: string;
  hop_depth: number;
  amount_reached: number;
  path: string[];
  tags: string[];
  is_sink: boolean;
}

export interface TraceResponse {
  target_address: string;
  currency: string;
  max_hops: number;
  total_nodes: number;
  total_edges: number;
  nodes: AddressNode[];
  transactions: Transaction[];
  end_receivers: EndReceiverSummary[];
  viz_html_available: boolean;
  viz_html_path?: string | null;
  execution_time_ms: number;
}

export interface TraceRequest {
  target_address: string;
  max_hops?: number;
  currency?: string;
  min_amount_threshold?: number;
  generate_viz?: boolean;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  source_address: string;
  currency: string;
  expected_destination?: string;
  mixer_contract?: string;
  adversarial_features: string[];
}

export interface ApiConfig {
  serverUrl: string;
  serverApiKey: string;
  etherscanApiKey: string;
  blockstreamApiKey: string;
}

export interface ServerHealth {
  status: 'ok' | 'error' | 'checking';
  service?: string;
  version?: string;
  latencyMs?: number;
  error?: string;
}

export interface FlowStep {
  stepNumber: number;
  hop: number;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  currency: string;
  fee?: number;
  timestamp: number;
  isAdversarial?: boolean;
  adversarialTag?: string | null;
  description: string;
  flowRole: 'source_trunk' | 'peel' | 'cashout' | 'dusting' | 'poisoning' | 'mixer_deposit' | 'mixer_payout';
}
