import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  KeyRound,
  Search,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Network,
  Share2,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ChainFlowPipeline } from './components/ChainFlowPipeline';
import { PyVisGraphViewer } from './components/PyVisGraphViewer';
import { AuditTrailViewer } from './components/AuditTrailViewer';
import { ForensicReportPanel } from './components/ForensicReportPanel';
import { ApiConfig, ServerHealth, TraceResponse } from './types';
import {
  checkServerHealth,
  findActiveBackendUrl,
  getApiConfig,
  resetApiConfig,
  resolveInput,
  saveApiConfig,
  traceAddress,
} from './services/api';

export const App: React.FC = () => {
  const [config, setConfig] = useState<ApiConfig>(getApiConfig());
  const [health, setHealth] = useState<ServerHealth>({ status: 'checking' });
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Currency: BTC or ETH
  const [currency, setCurrency] = useState<'BTC' | 'ETH'>('BTC');
  const [inputId, setInputId] = useState('');
  const [hops, setHops] = useState<number>(5);

  // Active view: pipeline, interactive pyvis graph, or audit trail
  const [viewMode, setViewMode] = useState<'pipeline' | 'pyvis' | 'audit'>('pipeline');

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  // Auto-connect to active server
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
    async (idToTrace: string, overrideCurrency?: 'BTC' | 'ETH') => {
      const trimmed = idToTrace.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setInputId(trimmed);

      try {
        // 1. Resolve Transaction ID to Person / Address & detect BTC vs ETH
        const resolved = await resolveInput(trimmed);
        const activeCurr = overrideCurrency || resolved.currency || currency;
        setCurrency(activeCurr);

        // 2. Query backend trace API
        const result = await traceAddress({
          target_address: resolved.resolvedAddress,
          max_hops: hops,
          currency: activeCurr,
          generate_viz: true,
        });

        setTrace(result);
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
      // Default initial trace so screen starts with an active flow immediately
      const defaultId = 'bc1q_hacker_ransomware_vault';
      setInputId(defaultId);
      handleTrace(defaultId, 'BTC');
    });
  }, []);

  const handleCurrencySwitch = (newCurrency: 'BTC' | 'ETH') => {
    setCurrency(newCurrency);
    if (newCurrency === 'ETH') {
      const ethDefault = '0xHacker_Ethereum_Vault_7a1b';
      setInputId(ethDefault);
      handleTrace(ethDefault, 'ETH');
    } else {
      const btcDefault = 'bc1q_hacker_ransomware_vault';
      setInputId(btcDefault);
      handleTrace(btcDefault, 'BTC');
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-300">
      {/* 1. TOP HEADER */}
      <header className="border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold shadow-md shadow-sky-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">ChainSentry</h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-semibold">
                FLOW INTELLIGENCE
              </span>
            </div>
          </div>

          {/* Currency Toggle & Connection Status */}
          <div className="flex items-center gap-3">
            {/* Currency Selector (Bitcoin vs Ethereum) */}
            <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 text-xs font-bold">
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 lg:px-8 py-6 space-y-5">
        {/* Simple Address / Transaction ID Input Bar (clean & simple) */}
        <section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTrace(inputId);
            }}
            className="flex flex-col sm:flex-row items-center gap-2 bg-[#090e1c] border border-slate-700/80 focus-within:border-sky-500 rounded-2xl p-2 shadow-2xl backdrop-blur-md transition"
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

            {/* Clean Input Field */}
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="Paste Wallet Address or Transaction ID to trace connection flow..."
              className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 px-3 py-2.5 focus:outline-none font-mono tracking-tight"
            />

            {/* Hops Depth Selector */}
            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono shrink-0">
              <span className="text-slate-400 text-[10px] uppercase font-semibold mr-1">Depth:</span>
              {[3, 5, 8, 10].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHops(h)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                    hops === h
                      ? 'bg-sky-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>

            {/* Action Button */}
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
        </section>

        {/* Error notification if any */}
        {error && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-xs text-amber-300">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* 2. FORENSIC ASSESSMENT REPORT PANEL */}
        {trace?.forensic_report && (
          <ForensicReportPanel report={trace.forensic_report} />
        )}

        {/* View Mode Switcher & Quick Stats Bar */}
        {trace && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* View Tabs */}
            <div className="flex items-center rounded-xl bg-slate-900/90 border border-slate-800 p-1 text-xs font-mono">
              <button
                type="button"
                onClick={() => setViewMode('pipeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-semibold ${
                  viewMode === 'pipeline'
                    ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Flow Pipeline</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('pyvis')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-semibold ${
                  viewMode === 'pyvis'
                    ? 'bg-indigo-500 text-white shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Interactive Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('audit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-semibold ${
                  viewMode === 'audit'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256 Audit Trail</span>
                {trace.audit_trail?.is_valid_chain && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                )}
              </button>
            </div>

            {/* Quick Metrics Tag */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{trace.execution_time_ms} ms</span>
              </span>
              <span>•</span>
              <span>{trace.total_nodes} Wallets</span>
              <span>•</span>
              <span>{trace.total_edges} Transfers</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">
                {trace.end_receivers.filter((r) => r.is_sink).length} Sinks
              </span>
            </div>
          </div>
        )}

        {/* 3. ACTIVE VIEW CONTENT */}
        {trace && (
          <section className="animate-fadeIn">
            {viewMode === 'pipeline' && (
              <ChainFlowPipeline trace={trace} currency={currency} />
            )}

            {viewMode === 'pyvis' && (
              <PyVisGraphViewer
                serverUrl={config.serverUrl}
                targetAddress={trace.target_address}
              />
            )}

            {viewMode === 'audit' && (
              <AuditTrailViewer
                auditTrail={trace.audit_trail}
                targetAddress={trace.target_address}
              />
            )}
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
