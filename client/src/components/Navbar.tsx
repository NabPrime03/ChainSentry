import React from 'react';
import { Shield, KeyRound, ExternalLink, RefreshCw } from 'lucide-react';
import { ServerHealth, BenchmarkScenario } from '../types';

interface NavbarProps {
  health: ServerHealth;
  onRefreshHealth: () => void;
  onOpenApiModal: () => void;
  benchmarks: BenchmarkScenario[];
  onSelectBenchmark: (scenario: BenchmarkScenario) => void;
  currency: string;
  onChangeCurrency: (c: string) => void;
  hasApiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  onRefreshHealth,
  onOpenApiModal,
  benchmarks,
  onSelectBenchmark,
  currency,
  onChangeCurrency,
  hasApiKey,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20 text-white font-bold ring-1 ring-sky-400/30">
            <Shield className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-sky-100 to-sky-400">
                ChainSentry
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60 font-semibold tracking-wider">
                FORENSIC ENGINE v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Confidence-Aware Crypto Transaction Flow Intelligence
            </p>
          </div>
        </div>

        {/* Action Controls & Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Scenario Benchmark Selector */}
          <div className="relative">
            <select
              className="bg-slate-900/90 text-xs text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 transition cursor-pointer"
              defaultValue=""
              onChange={(e) => {
                const scen = benchmarks.find((b) => b.id === e.target.value);
                if (scen) onSelectBenchmark(scen);
                e.target.value = '';
              }}
            >
              <option value="" disabled>
                📂 Load Forensic Scenarios...
              </option>
              {benchmarks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-medium">
            <button
              onClick={() => onChangeCurrency('BTC')}
              className={`px-2.5 py-1 rounded-md transition ${
                currency === 'BTC'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              BTC
            </button>
            <button
              onClick={() => onChangeCurrency('ETH')}
              className={`px-2.5 py-1 rounded-md transition ${
                currency === 'ETH'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ETH
            </button>
          </div>

          {/* Server Health Status */}
          <div
            onClick={onRefreshHealth}
            title={`Backend Status: ${health.status} (${health.latencyMs ?? 0}ms). Click to re-test.`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border cursor-pointer transition select-none ${
              health.status === 'ok'
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/40'
                : health.status === 'checking'
                ? 'bg-slate-900 text-slate-400 border-slate-800'
                : 'bg-rose-950/40 text-rose-400 border-rose-800/60 hover:bg-rose-900/40'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${health.status === 'ok' ? 'bg-emerald-400 animate-pulse' : health.status === 'checking' ? 'bg-amber-400' : 'bg-rose-400'}`} />
            <span>{health.status === 'ok' ? `Backend: ${health.latencyMs}ms` : health.status === 'checking' ? 'Connecting...' : 'Backend Offline'}</span>
            <RefreshCw className={`w-3 h-3 text-slate-500 ml-0.5 ${health.status === 'checking' ? 'animate-spin' : ''}`} />
          </div>

          {/* API Keys Settings Modal Trigger */}
          <button
            onClick={onOpenApiModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-sky-500/60 transition shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5 text-sky-400" />
            <span>API Keys</span>
            {hasApiKey && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="API Key Configured" />
            )}
          </button>

          {/* Docs Link */}
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="Open Interactive API Docs (Swagger)"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
