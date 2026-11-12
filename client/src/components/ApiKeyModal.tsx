import React, { useState } from 'react';
import { KeyRound, X, CheckCircle2, AlertCircle, RefreshCw, Server, Globe, ShieldCheck } from 'lucide-react';
import { ApiConfig, ServerHealth } from '../types';
import { checkServerHealth } from '../services/api';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (config: ApiConfig) => void;
  onReset: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  onReset,
}) => {
  const [formConfig, setFormConfig] = useState<ApiConfig>(config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ServerHealth | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await checkServerHealth(formConfig);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        status: 'error',
        error: e.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave(formConfig);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 700);
  };

  const handleReset = () => {
    onReset();
    setFormConfig({
      serverUrl: 'http://localhost:8000',
      serverApiKey: 'chainsentry-sec-api-key-live',
      etherscanApiKey: '',
      blockstreamApiKey: '',
    });
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">API Keys & Server Integration</h2>
              <p className="text-xs text-slate-400">
                Configure authentication keys for ChainSentry backend & blockchain explorers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Security Notice */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-sky-950/30 border border-sky-800/40 text-xs text-sky-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
            <p>
              API keys are stored securely in your browser's local memory and sent directly to your
              ChainSentry backend using <code className="text-sky-200 bg-sky-950 px-1 py-0.5 rounded">X-API-Key</code> and{' '}
              <code className="text-sky-200 bg-sky-950 px-1 py-0.5 rounded">Authorization: Bearer</code> headers.
            </p>
          </div>

          {/* Backend Server URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>Backend API Server Endpoint</span>
            </label>
            <input
              type="text"
              value={formConfig.serverUrl}
              onChange={(e) => setFormConfig({ ...formConfig, serverUrl: e.target.value })}
              placeholder="http://localhost:8000"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition"
            />
            <p className="text-[11px] text-slate-500">
              Default: <code className="text-slate-400">http://localhost:8000</code>.
            </p>
          </div>

          {/* Backend Server API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                <span>ChainSentry Server API Key</span>
              </span>
              <span className="text-[10px] text-sky-400 uppercase tracking-wider font-mono">Header: X-API-Key</span>
            </label>
            <input
              type="password"
              value={formConfig.serverApiKey}
              onChange={(e) => setFormConfig({ ...formConfig, serverApiKey: e.target.value })}
              placeholder="chainsentry-sec-api-key-live"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition"
            />
            <p className="text-[11px] text-slate-500">
              Authenticated header passed on all forensic queries (<code className="text-slate-400">/api/v1/trace</code>, <code className="text-slate-400">/api/v1/health</code>).
            </p>
          </div>

          {/* Etherscan API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Etherscan API Key (Ethereum Ingestion)</span>
              </span>
              <span className="text-[10px] text-indigo-400 font-mono">Optional</span>
            </label>
            <input
              type="password"
              value={formConfig.etherscanApiKey}
              onChange={(e) => setFormConfig({ ...formConfig, etherscanApiKey: e.target.value })}
              placeholder="e.g. YH39872DHD873..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
            />
            <p className="text-[11px] text-slate-500">
              Enables live Ethereum account querying with high rate limits via Etherscan.
            </p>
          </div>

          {/* Blockstream / Mempool API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>Blockstream / Mempool API Key (Bitcoin)</span>
              </span>
              <span className="text-[10px] text-amber-400 font-mono">Optional</span>
            </label>
            <input
              type="password"
              value={formConfig.blockstreamApiKey}
              onChange={(e) => setFormConfig({ ...formConfig, blockstreamApiKey: e.target.value })}
              placeholder="e.g. mpp_live_..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
            />
            <p className="text-[11px] text-slate-500">
              For elevated Bitcoin transaction inspection and live UTXO peel tracing.
            </p>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-sky-400' : ''}`} />
                <span>{testing ? 'Testing Connection...' : 'Test Server & Key'}</span>
              </button>

              {testResult && (
                <div
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-mono ${
                    testResult.status === 'ok'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80'
                      : 'bg-rose-950/60 text-rose-400 border border-rose-800/80'
                  }`}
                >
                  {testResult.status === 'ok' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Connected ({testResult.latencyMs}ms)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>{testResult.error || 'Connection Failed'}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Reset Defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow-lg shadow-sky-500/20"
            >
              {showSavedToast ? 'Saved!' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
