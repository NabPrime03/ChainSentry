import React, { useState } from 'react';
import { Search, Sparkles, SlidersHorizontal, ArrowRight, Tag } from 'lucide-react';
import { KNOWN_TRANSACTIONS_MAP } from '../services/api';

interface SearchBarProps {
  onSearch: (input: string, maxHops: number, minAmount: number) => void;
  loading: boolean;
  activeInput: string;
  currency: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  loading,
  activeInput,
  currency,
}) => {
  const [query, setQuery] = useState(activeInput || 'tx_hop1_trunk_001');
  const [maxHops, setMaxHops] = useState(3);
  const [minAmount, setMinAmount] = useState(0.0);
  const [showFilters, setShowFilters] = useState(false);

  // Sync when activeInput changes from presets outside
  React.useEffect(() => {
    if (activeInput) {
      setQuery(activeInput);
    }
  }, [activeInput]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim(), maxHops, minAmount);
  };

  const isTxQuery = Boolean(
    KNOWN_TRANSACTIONS_MAP[query.trim()] ||
    query.startsWith('tx_') ||
    (query.length >= 64 && !query.startsWith('bc1'))
  );

  return (
    <div className="w-full space-y-3">
      {/* Search Input Box */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-slate-900/90 border border-slate-700/80 hover:border-sky-500/50 focus-within:border-sky-500 rounded-2xl p-2 shadow-2xl backdrop-blur-md transition group"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Icon & Type Badge */}
          <div className="flex items-center pl-3 gap-2 text-slate-400">
            <Search className="w-5 h-5 text-sky-400 shrink-0" />
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-md uppercase font-semibold shrink-0 transition ${
                isTxQuery
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              }`}
            >
              {isTxQuery ? 'TX HASH' : 'PERSON / WALLET'}
            </span>
          </div>

          {/* Text Input */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Transaction ID (e.g. tx_hop1_trunk_001) or Person Address (e.g. bc1q_hacker...)"
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 px-2 py-2 focus:outline-none font-mono tracking-tight"
          />

          {/* Filter Toggle & Submit Button */}
          <div className="flex items-center gap-2 pr-1">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-1.5 transition ${
                showFilters || maxHops !== 3 || minAmount > 0
                  ? 'bg-sky-950/60 text-sky-300 border-sky-600/60'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Toggle Traversal Filters (Max Hops, Amount Threshold)"
            >
              <SlidersHorizontal className="w-4 h-4 text-sky-400" />
              <span className="hidden md:inline font-mono text-[11px]">
                Hops: {maxHops}
              </span>
            </button>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-sky-500/20 disabled:opacity-50 transition active:scale-95"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Tracing Flow...</span>
                </>
              ) : (
                <>
                  <span>Trace Flow</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Filters Bar */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 px-3 grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1 text-xs">
            <div>
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span>Max Forward Hops: <strong className="text-sky-400 font-mono">{maxHops} hops</strong></span>
                <span className="text-[10px] text-slate-500 font-mono">1 to 6 BFS depth</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                value={maxHops}
                onChange={(e) => setMaxHops(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span>Min Amount Threshold: <strong className="text-amber-400 font-mono">{minAmount} {currency}</strong></span>
                <span className="text-[10px] text-slate-500">Filter noise & dust</span>
              </div>
              <input
                type="number"
                step="0.001"
                min="0"
                value={minAmount}
                onChange={(e) => setMinAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        )}
      </form>

      {/* Quick Transaction & Person Preset Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400 text-[11px] flex items-center gap-1 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Presets:</span>
        </span>

        {/* BTC Tx 1 */}
        <button
          type="button"
          onClick={() => {
            setQuery('tx_hop1_trunk_001');
            onSearch('tx_hop1_trunk_001', maxHops, minAmount);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-slate-300 transition text-[11px] font-mono group"
        >
          <Tag className="w-3 h-3 text-amber-400" />
          <span>tx_hop1_trunk_001</span>
          <span className="text-[10px] text-slate-500 group-hover:text-amber-300">(BTC Trunk 47.9)</span>
        </button>

        {/* BTC Tx 3 (Cashout) */}
        <button
          type="button"
          onClick={() => {
            setQuery('tx_hop3_cashout_007');
            onSearch('tx_hop3_cashout_007', maxHops, minAmount);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 transition text-[11px] font-mono group"
        >
          <Tag className="w-3 h-3 text-emerald-400" />
          <span>tx_hop3_cashout_007</span>
          <span className="text-[10px] text-slate-500 group-hover:text-emerald-300">(Binance Cashout 40.0)</span>
        </button>

        {/* ETH Mixer Tx */}
        <button
          type="button"
          onClick={() => {
            setQuery('0xeth_tx_01');
            onSearch('0xeth_tx_01', maxHops, minAmount);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-slate-300 transition text-[11px] font-mono group"
        >
          <Tag className="w-3 h-3 text-indigo-400" />
          <span>0xeth_tx_01</span>
          <span className="text-[10px] text-slate-500 group-hover:text-indigo-300">(ETH Mixer 10.0)</span>
        </button>

        {/* BTC Source Address */}
        <button
          type="button"
          onClick={() => {
            setQuery('bc1q_hacker_ransomware_vault');
            onSearch('bc1q_hacker_ransomware_vault', maxHops, minAmount);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-slate-300 transition text-[11px] font-mono group"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>bc1q_hacker...</span>
          <span className="text-[10px] text-slate-500 group-hover:text-rose-300">(Person Vault)</span>
        </button>

        {/* ETH Source Address */}
        <button
          type="button"
          onClick={() => {
            setQuery('0xHacker_Ethereum_Vault_7a1b');
            onSearch('0xHacker_Ethereum_Vault_7a1b', maxHops, minAmount);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-slate-300 transition text-[11px] font-mono group"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>0xHacker_Eth...</span>
          <span className="text-[10px] text-slate-500 group-hover:text-sky-300">(ETH Vault)</span>
        </button>
      </div>
    </div>
  );
};
