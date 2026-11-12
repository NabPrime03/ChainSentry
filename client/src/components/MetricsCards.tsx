import React from 'react';
import {
  Coins,
  Network,
  Share2,
  ShieldAlert,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { TraceResponse } from '../types';
import { formatCrypto } from '../services/api';

interface MetricsCardsProps {
  trace: TraceResponse;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ trace }) => {
  // Compute total volume
  const totalVolume = trace.transactions.reduce((acc, tx) => acc + tx.amount, 0);
  const adversarialCount = trace.transactions.filter((tx) => tx.is_adversarial).length;
  const cashoutsCount = trace.end_receivers.filter((r) => r.is_sink).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total Flow Volume */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-medium">Total Flow Volume</span>
          <Coins className="w-4 h-4 text-amber-400" />
        </div>
        <p className="text-sm sm:text-base font-bold font-mono text-white truncate">
          {formatCrypto(totalVolume, trace.currency)}
        </p>
        <span className="text-[10px] text-slate-500 font-mono block">
          Across {trace.total_edges} transactions
        </span>
      </div>

      {/* Discovered Wallets */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-medium">Discovered Wallets</span>
          <Network className="w-4 h-4 text-sky-400" />
        </div>
        <p className="text-sm sm:text-base font-bold font-mono text-white">
          {trace.total_nodes} Addresses
        </p>
        <span className="text-[10px] text-slate-500 font-mono block">
          NetworkX graph nodes
        </span>
      </div>

      {/* Traversal Depth */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-medium">Traversal Depth</span>
          <Share2 className="w-4 h-4 text-indigo-400" />
        </div>
        <p className="text-sm sm:text-base font-bold font-mono text-white">
          {trace.max_hops} Hops
        </p>
        <span className="text-[10px] text-slate-500 font-mono block">
          Multi-hop forward BFS
        </span>
      </div>

      {/* Cash-Out Sinks */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-medium">Destination Sinks</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <p className="text-sm sm:text-base font-bold font-mono text-emerald-400">
          {cashoutsCount} Cashouts
        </p>
        <span className="text-[10px] text-slate-500 font-mono block">
          Exit exchange points
        </span>
      </div>

      {/* Adversarial Traps Flagged */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-medium">Adversarial Threats</span>
          <ShieldAlert className="w-4 h-4 text-rose-400" />
        </div>
        <p className="text-sm sm:text-base font-bold font-mono text-rose-400">
          {adversarialCount} Flagged
        </p>
        <span className="text-[10px] text-slate-500 font-mono block">
          Dusting / Poisoning traps
        </span>
      </div>

      {/* Forensic Speed */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-medium">Backend Runtime</span>
          <Clock className="w-4 h-4 text-slate-400" />
        </div>
        <p className="text-sm sm:text-base font-bold font-mono text-slate-200">
          {trace.execution_time_ms} ms
        </p>
        <span className="text-[10px] text-slate-500 font-mono block">
          Real-time Graph Engine
        </span>
      </div>
    </div>
  );
};
