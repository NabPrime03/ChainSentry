import React, { useState, useEffect, useCallback } from 'react';
import { Shield, KeyRound, Search, ArrowRight, Sparkles, RefreshCw, AlertCircle, Coins } from 'lucide-react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ConnectionFlowChart } from './components/ConnectionFlowChart';
import { ApiConfig, FlowStep, ServerHealth, TraceResponse } from './types';
import {
  checkServerHealth,
  findActiveBackendUrl,
  generateFlowSteps,
  getApiConfig,
  resetApiConfig,
  resolveInput,
  saveApiConfig,
  traceAddress
} from './services/api';

export const App: React.FC = () => {
  const [config, setConfig] = useState<ApiConfig>(getApiConfig());
  const [health, setHealth] = useState<ServerHealth>({ status: 'checking' });
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Currency: BTC or ETH
  const [currency, setCurrency] = useState<'BTC' | 'ETH'>('BTC');
  const [inputId, setInputId] = useState('tx_hop1_trunk_001');

  // Connection flow steps
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [activeStep, setActiveStep] = useState<FlowStep | null>(null);

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  // Auto-connect and load health
  const refreshConnection = useCallback(async () => {
    setHealth({ status: 'checking' });
    const activeUrl = await findActiveBackendUrl();
    const currentCfg = getApiConfig();
    if (currentCfg.serverUrl !== activeUrl) {
      currentCfg.serverUrl = activeUrl;
      saveApiConfig(currentCfg);
      setConfig({ ...currentCfg });
    }
    const h = await checkServerHealth(currentCfg);
    setHealth(h);
  }, []);

  // Main trace function
  const handleTrace = useCallback(
    async (idToTrace: string, selectedCurrency?: 'BTC' | 'ETH') => {
      const trimmed = idToTrace.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setInputId(trimmed);

      try {
        // 1. Resolve Transaction ID to Person / Address & detect BTC vs ETH
        const resolved = await resolveInput(trimmed);
        const activeCurr = selectedCurrency || resolved.currency || currency;
        setCurrency(activeCurr);

        // 2. Fetch connection trace from backend
        const result = await traceAddress({
          target_address: resolved.resolvedAddress,
          max_hops: 3,
          currency: activeCurr,
          generate_viz: true,
        });

        setTrace(result);

        // 3. Build connection flow chart steps
        const steps = generateFlowSteps(result);
        setFlowSteps(steps);

        // 4. Highlight matched step if user searched for specific tx
        if (resolved.initialTxHash) {
          const matched = steps.find(
            (s) => s.txHash.toLowerCase() === resolved.initialTxHash?.toLowerCase()
          );
          setActiveStep(matched || steps[0] || null);
        } else if (steps.length > 0) {
          setActiveStep(steps[0]);
        }
      } catch (err: any) {
        console.error('Trace error', err);
        setError(
          err.message || 'Could not trace connection. Please check that the server is running.'
        );
      } finally {
        setLoading(false);
      }
    },
    [currency]
  );

  // Initial load
  useEffect(() => {
    refreshConnection().then(() => {
      handleTrace('tx_hop1_trunk_001', 'BTC');
    });
  }, []);

  const handleCurrencySwitch = (newCurrency: 'BTC' | 'ETH') => {
    setCurrency(newCurrency);
    if (newCurrency === 'ETH') {
      setInputId('0xeth_tx_01');
      handleTrace('0xeth_tx_01', 'ETH');
    } else {
      setInputId('tx_hop1_trunk_001');
      handleTrace('tx_hop1_trunk_001', 'BTC');
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-300">
      {/* 1. CLEAN TOP HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold shadow-md shadow-sky-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white">ChainSentry</h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-semibold">
                  FLOW INTELLIGENCE
                </span>
              </div>
            </div>
          </div>

          {/* Currency Toggle & Connection Status */}
          <div className="flex items-center gap-3">
            {/* Currency Selector (Bitcoin vs Ethereum) */}
            <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleCurrencySwitch('BTC')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                  currency === 'BTC'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>₿ Bitcoin (BTC)</span>
              </button>
              <button
                type="button"
                onClick={() => handleCurrencySwitch('ETH')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                  currency === 'ETH'
                    ? 'bg-indigo-500 text-white shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Ξ Ethereum (ETH)</span>
              </button>
            </div>

            {/* Connection Status Pill */}
            <div
              onClick={refreshConnection}
              title="Click to re-verify server connection"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border cursor-pointer select-none transition ${
                health.status === 'ok'
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/40'
                  : 'bg-rose-950/40 text-rose-400 border-rose-800/80 hover:bg-rose-900/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${health.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{health.status === 'ok' ? 'Server Connected' : 'Connecting...'}</span>
              <RefreshCw className={`w-3 h-3 text-slate-500 ml-1 ${health.status === 'checking' ? 'animate-spin' : ''}`} />
            </div>

            {/* API Keys Settings Trigger */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
              title="Configure API Keys & Server URL"
            >
              <KeyRound className="w-4 h-4 text-sky-400" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN BODY */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Clean Address / Transaction ID Input Bar */}
        <section className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTrace(inputId);
            }}
            className="flex flex-col sm:flex-row items-center gap-2 bg-slate-900/90 border border-slate-700/80 focus-within:border-sky-500 rounded-2xl p-2 shadow-xl backdrop-blur-md transition"
          >
            {/* Input Icon & Detected Currency Badge */}
            <div className="flex items-center pl-3 gap-2 text-slate-400 shrink-0">
              <Search className="w-5 h-5 text-sky-400" />
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                  currency === 'BTC'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {currency === 'BTC' ? '₿ BITCOIN' : 'Ξ ETHEREUM'}
              </span>
            </div>

            {/* The Main Address / ID Input */}
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="Enter Transaction ID or Person Address (e.g. tx_hop1_trunk_001)..."
              className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 px-2 py-2 focus:outline-none font-mono tracking-tight"
            />

            {/* Trace Flow Action Button */}
            <button
              type="submit"
              disabled={loading || !inputId.trim()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Tracing...</span>
                </>
              ) : (
                <>
                  <span>Trace Flow</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 text-xs flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sample IDs:</span>
            </span>

            {/* BTC Preset 1 */}
            <button
              type="button"
              onClick={() => {
                setCurrency('BTC');
                setInputId('tx_hop1_trunk_001');
                handleTrace('tx_hop1_trunk_001', 'BTC');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500 text-slate-300 font-mono text-[11px] transition"
            >
              ₿ tx_hop1_trunk_001 <span className="text-slate-500">(BTC Trunk)</span>
            </button>

            {/* BTC Preset 2 */}
            <button
              type="button"
              onClick={() => {
                setCurrency('BTC');
                setInputId('tx_hop3_cashout_007');
                handleTrace('tx_hop3_cashout_007', 'BTC');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500 text-slate-300 font-mono text-[11px] transition"
            >
              ₿ tx_hop3_cashout_007 <span className="text-slate-500">(Binance Cashout)</span>
            </button>

            {/* ETH Preset */}
            <button
              type="button"
              onClick={() => {
                setCurrency('ETH');
                setInputId('0xeth_tx_01');
                handleTrace('0xeth_tx_01', 'ETH');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 text-slate-300 font-mono text-[11px] transition"
            >
              Ξ 0xeth_tx_01 <span className="text-slate-500">(ETH Mixer Tx)</span>
            </button>

            {/* Person Vault Address */}
            <button
              type="button"
              onClick={() => {
                setCurrency('BTC');
                setInputId('bc1q_hacker_ransomware_vault');
                handleTrace('bc1q_hacker_ransomware_vault', 'BTC');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500 text-slate-300 font-mono text-[11px] transition"
            >
              🎯 bc1q_hacker_vault <span className="text-slate-500">(Person Address)</span>
            </button>
          </div>
        </section>

        {/* Error notification if any */}
        {error && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-xs text-amber-300">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* 3. THE CONNECTION FLOW CHART */}
        {trace && (
          <section className="animate-fadeIn">
            <ConnectionFlowChart
              trace={trace}
              flowSteps={flowSteps}
              activeStep={activeStep}
              onSelectStep={(step) => setActiveStep(step)}
              currency={currency}
            />
          </section>
        )}
      </main>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        config={config}
        onSave={(newCfg) => {
          setConfig(newCfg);
          saveApiConfig(newCfg);
          refreshConnection();
        }}
        onReset={() => {
          const def = resetApiConfig();
          setConfig(def);
          refreshConnection();
        }}
      />
    </div>
  );
};
