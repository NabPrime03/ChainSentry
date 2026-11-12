import React, { useState, useMemo } from 'react';
import {
  Layers,
  ArrowRight,
  ShieldAlert,
  ExternalLink,
  Info,
  Share2
} from 'lucide-react';
import { AddressNode, FlowStep, TraceResponse, Transaction } from '../types';
import { formatCrypto, shortenAddr } from '../services/api';

interface FlowVisualizerProps {
  trace: TraceResponse;
  activeTxHash?: string;
  activeStep?: FlowStep | null;
  onSelectTx: (tx: Transaction) => void;
  serverUrl: string;
}

export const FlowVisualizer: React.FC<FlowVisualizerProps> = ({
  trace,
  activeTxHash,
  activeStep,
  onSelectTx,
  serverUrl,
}) => {
  const [viewMode, setViewMode] = useState<'canvas' | 'pyvis'>('canvas');
  const [selectedNode, setSelectedNode] = useState<AddressNode | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [hideAdversarial, setHideAdversarial] = useState(false);

  // Group nodes by hop distance
  const { hopColumns, maxHops } = useMemo(() => {
    const cols: Record<number, AddressNode[]> = {};
    let max = 0;

    for (const node of trace.nodes) {
      const hop = node.hop_distance ?? (node.is_source ? 0 : 1);
      if (hop > max) max = hop;
      if (!cols[hop]) cols[hop] = [];
      cols[hop].push(node);
    }

    return { hopColumns: cols, maxHops: max };
  }, [trace.nodes]);

  // Filter transactions
  const visibleTransactions = useMemo(() => {
    if (hideAdversarial) {
      return trace.transactions.filter((tx) => !tx.is_adversarial);
    }
    return trace.transactions;
  }, [trace.transactions, hideAdversarial]);

  // Find node by address
  const getNode = (addr: string) => trace.nodes.find((n) => n.address === addr);

  // PyVis interactive iframe URL
  const pyvisUrl = `${serverUrl}/api/v1/graph/html?address=${encodeURIComponent(
    trace.target_address
  )}`;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Visualizer Top Bar */}
      <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Transaction Flow Reconstruction
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {trace.total_nodes} Wallets • {trace.total_edges} Transfers
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Source: <span className="font-mono text-sky-300">{shortenAddr(trace.target_address, 10)}</span>
            </p>
          </div>
        </div>

        {/* View Mode & Toggles */}
        <div className="flex items-center gap-2.5">
          {/* Hide/Show Adversarial */}
          <button
            onClick={() => setHideAdversarial(!hideAdversarial)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              hideAdversarial
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/80'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border-slate-700'
            }`}
            title="Filter out decoy dusting attacks and spoofed zero-value poisoning"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">{hideAdversarial ? 'Adversarial Hidden' : 'Show All Traps'}</span>
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg bg-slate-800/90 border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1 rounded-md transition font-medium ${
                viewMode === 'canvas'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hop Flow Pipeline
            </button>
            <button
              onClick={() => setViewMode('pyvis')}
              className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                viewMode === 'pyvis'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Physics Network</span>
              <Share2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Flow Presentation Area */}
      <div className="relative min-h-[500px] flex flex-col lg:flex-row">
        {viewMode === 'canvas' ? (
          <div className="flex-1 p-6 overflow-x-auto overflow-y-auto">
            {/* Flow Legend */}
            <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30" />
                <span>Person / Hacker Source</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
                <span>Intermediary Peel Hop</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
                <span>Destination / Cash-Out Sink</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 ring-2 ring-rose-400/30 border border-dashed border-rose-400" />
                <span>Adversarial Trap (Dusting/Poisoning)</span>
              </span>
            </div>

            {/* Hop Columns Grid */}
            <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-8 min-w-[750px] pb-6">
              {Array.from({ length: maxHops + 1 }).map((_, hopIdx) => {
                const nodesInHop = hopColumns[hopIdx] || [];
                return (
                  <div key={hopIdx} className="space-y-4">
                    {/* Hop Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-sky-950 border border-sky-800/60 text-sky-400 font-mono text-xs font-bold">
                          H{hopIdx}
                        </span>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">
                            {hopIdx === 0
                              ? 'Origin Person / Vault'
                              : hopIdx === maxHops
                              ? 'Exit Sinks / Cashout'
                              : `Hop ${hopIdx} Intermediaries`}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {nodesInHop.length} address{nodesInHop.length !== 1 ? 'es' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Nodes in this hop */}
                    <div className="space-y-4">
                      {nodesInHop.map((node) => {
                        const isSource = node.is_source;
                        const isSink = node.out_degree === 0;
                        const isSelected = selectedNode?.address === node.address;
                        const isHighlightedInStep =
                          activeStep &&
                          (activeStep.fromAddress === node.address ||
                            activeStep.toAddress === node.address);

                        // Find outgoing edges from this node
                        const outgoingTxs = visibleTransactions.filter(
                          (t) => t.from_address === node.address
                        );

                        return (
                          <div
                            key={node.address}
                            onClick={() => {
                              setSelectedNode(node);
                              setSelectedTx(null);
                            }}
                            className={`group relative rounded-xl p-3.5 border transition cursor-pointer ${
                              isSelected
                                ? 'bg-sky-950/60 border-sky-400 ring-2 ring-sky-500/20 shadow-lg shadow-sky-500/10'
                                : isHighlightedInStep
                                ? 'bg-slate-800/90 border-amber-400 ring-2 ring-amber-400/30'
                                : isSource
                                ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-500/60'
                                : isSink
                                ? 'bg-emerald-950/20 border-emerald-800/60 hover:border-emerald-500/60'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* Node Header */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    isSource
                                      ? 'bg-rose-500 ring-4 ring-rose-500/20'
                                      : isSink
                                      ? 'bg-emerald-400 ring-4 ring-emerald-400/20'
                                      : 'bg-amber-400 ring-4 ring-amber-400/20'
                                  }`}
                                />
                                <span className="font-mono text-xs font-semibold text-white tracking-tight break-all">
                                  {shortenAddr(node.address, 7)}
                                </span>
                              </div>

                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                                  isSource
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : isSink
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {isSource ? 'SOURCE' : isSink ? 'SINK' : 'PEEL HOP'}
                              </span>
                            </div>

                            {/* Node Balance & Degree Stats */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Outflow:</span>
                                <span className="text-slate-200">
                                  {node.total_sent > 0 ? formatCrypto(node.total_sent, trace.currency) : '0.00'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Balance Est:</span>
                                <span
                                  className={
                                    node.balance_estimate >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }
                                >
                                  {formatCrypto(node.balance_estimate, trace.currency)}
                                </span>
                              </div>
                            </div>

                            {/* Outgoing Forward Transfers from this node */}
                            {outgoingTxs.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-slate-800/60 space-y-1.5">
                                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider flex items-center justify-between">
                                  <span>Outgoing Flow ({outgoingTxs.length})</span>
                                  <ArrowRight className="w-3 h-3 text-slate-500" />
                                </span>

                                {outgoingTxs.map((tx) => {
                                  const isTxActive =
                                    activeTxHash === tx.tx_hash ||
                                    activeStep?.txHash === tx.tx_hash ||
                                    selectedTx?.tx_hash === tx.tx_hash;

                                  return (
                                    <div
                                      key={tx.tx_hash}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTx(tx);
                                        onSelectTx(tx);
                                      }}
                                      className={`p-2 rounded-lg text-xs font-mono border transition flex items-center justify-between gap-2 ${
                                        isTxActive
                                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-400'
                                          : tx.is_adversarial
                                          ? 'bg-rose-950/20 border-rose-900/60 text-rose-300 hover:border-rose-500/60'
                                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                                      }`}
                                    >
                                      <div className="truncate">
                                        <div className="flex items-center gap-1.5">
                                          {tx.is_adversarial && (
                                            <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                                          )}
                                          <span className="font-bold text-white">
                                            {formatCrypto(tx.amount, tx.currency)}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 block truncate">
                                          → {shortenAddr(tx.to_address, 6)}
                                        </span>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <span className="text-[9px] text-sky-400 block underline truncate">
                                          {shortenAddr(tx.tx_hash, 4)}
                                        </span>
                                        {tx.adversarial_tag && (
                                          <span className="text-[8px] px-1 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800/80">
                                            {tx.adversarial_tag}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Embedded PyVis Physics 3D Graph */
          <div className="flex-1 w-full h-[600px] relative bg-slate-950">
            <iframe
              src={pyvisUrl}
              title="Interactive PyVis Graph View"
              className="w-full h-full border-0"
            />
            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>PyVis ForceAtlas2 Physics Active • Drag nodes to reposition</span>
              <a
                href={pyvisUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1 ml-2"
              >
                <span>Full Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Selected Entity Dossier Sidebar */}
        {(selectedNode || selectedTx) && (
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950/90 p-5 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                <span>Forensic Inspector</span>
              </h4>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setSelectedTx(null);
                }}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            {selectedNode && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Address</span>
                  <p className="font-mono text-xs text-white break-all mt-0.5 select-all">
                    {selectedNode.address}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        selectedNode.is_source
                          ? 'bg-rose-500/20 text-rose-300'
                          : selectedNode.out_degree === 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      Hop {selectedNode.hop_distance ?? (selectedNode.is_source ? 0 : 1)}
                    </span>
                    {selectedNode.is_source && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-bold">
                        ORIGIN VAULT
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">In-Degree</span>
                    <span className="text-slate-200 font-bold">{selectedNode.in_degree}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Out-Degree</span>
                    <span className="text-slate-200 font-bold">{selectedNode.out_degree}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Total Received</span>
                    <span className="text-emerald-400 font-bold">
                      {formatCrypto(selectedNode.total_received, trace.currency)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Total Sent</span>
                    <span className="text-rose-400 font-bold">
                      {formatCrypto(selectedNode.total_sent, trace.currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedTx && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Transaction Hash</span>
                  <p className="font-mono text-xs text-sky-300 break-all mt-0.5 select-all">
                    {selectedTx.tx_hash}
                  </p>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Amount Transferred</span>
                    <span className="text-amber-400 font-bold text-sm">
                      {formatCrypto(selectedTx.amount, selectedTx.currency)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Sender (From)</span>
                    <span className="text-slate-200 break-all text-[11px] block mt-0.5">
                      {selectedTx.from_address}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Recipient (To)</span>
                    <span className="text-slate-200 break-all text-[11px] block mt-0.5">
                      {selectedTx.to_address}
                    </span>
                  </div>

                  {selectedTx.is_adversarial && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300">
                      <span className="text-[10px] font-bold block uppercase tracking-wider text-rose-400">
                        ⚠️ Adversarial Trap Flag
                      </span>
                      <p className="text-[11px] mt-1 font-sans">
                        {selectedTx.adversarial_tag || 'DECOY TRANSACTION'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
