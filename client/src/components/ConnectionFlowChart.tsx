import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Shield,
  ShieldAlert,
  Building,
  CheckCircle2,
  Copy,
  Check,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { FlowStep, TraceResponse, Transaction } from '../types';
import { formatCrypto, shortenAddr } from '../services/api';

interface ConnectionFlowChartProps {
  trace: TraceResponse;
  flowSteps: FlowStep[];
  activeStep: FlowStep | null;
  onSelectStep: (step: FlowStep) => void;
  currency: string;
}

export const ConnectionFlowChart: React.FC<ConnectionFlowChartProps> = ({
  trace,
  flowSteps,
  activeStep,
  onSelectStep,
  currency,
}) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const currentIdx = flowSteps.findIndex((s) => s.stepNumber === activeStep?.stepNumber);

  // Auto-play walkthrough
  React.useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        if (currentIdx < flowSteps.length - 1) {
          onSelectStep(flowSteps[currentIdx + 1]);
        } else {
          setIsPlaying(false);
        }
      }, 2200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentIdx, flowSteps, onSelectStep]);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Group steps by Hop level for a clean connection flow chart layout
  const hopsMap = new Map<number, FlowStep[]>();
  for (const step of flowSteps) {
    const list = hopsMap.get(step.hop) || [];
    list.push(step);
    hopsMap.set(step.hop, list);
  }
  const hopLevels = Array.from(hopsMap.keys()).sort((a, b) => a - b);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-6">
      {/* Flow Chart Header & Walkthrough Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              Transaction Connection Flow Chart
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 font-bold">
              {trace.total_nodes} Wallets • {trace.total_edges} Connections
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Traced fund traversal from Origin Person through intermediary hops to destination sinks
          </p>
        </div>

        {/* Walkthrough Stepper Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setIsPlaying(false);
              if (flowSteps.length) onSelectStep(flowSteps[0]);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Restart Flow"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            disabled={currentIdx <= 0}
            onClick={() => {
              setIsPlaying(false);
              if (currentIdx > 0) onSelectStep(flowSteps[currentIdx - 1]);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-40"
            title="Previous Step"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-sky-500/20 transition active:scale-95"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause Flow</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play Flow</span>
              </>
            )}
          </button>
          <button
            disabled={currentIdx >= flowSteps.length - 1}
            onClick={() => {
              setIsPlaying(false);
              if (currentIdx < flowSteps.length - 1) onSelectStep(flowSteps[currentIdx + 1]);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-40"
            title="Next Step"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* START NODE: The Person / Origin Wallet */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-xl bg-gradient-to-r from-rose-950/40 to-slate-950 border-2 border-rose-500/80 rounded-2xl p-4 shadow-xl shadow-rose-950/30 text-center relative group">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-rose-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow">
            ORIGIN PERSON / VAULT
          </span>

          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="font-mono text-sm sm:text-base font-bold text-white break-all">
              {trace.target_address}
            </span>
            <button
              onClick={(e) => handleCopy(trace.target_address, e)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              title="Copy Address"
            >
              {copiedText === trace.target_address ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mt-2 text-xs font-mono text-slate-400">
            <span>Currency: <strong className="text-amber-400">{currency}</strong></span>
            <span>•</span>
            <span>Initial Balance Outflow: <strong className="text-rose-400">
              {formatCrypto(
                trace.nodes.find((n) => n.is_source)?.total_sent || 0,
                currency
              )}
            </strong></span>
          </div>
        </div>

        {/* Downward Connection Stem */}
        <div className="flex flex-col items-center my-2 text-sky-400">
          <div className="w-0.5 h-6 bg-gradient-to-b from-rose-500 to-sky-500" />
          <ArrowDown className="w-4 h-4 text-sky-400 animate-bounce" />
        </div>
      </div>

      {/* CONNECTION FLOW STEPS: Arranged by Hop Sequence */}
      <div className="space-y-8">
        {hopLevels.map((hopNum) => {
          const stepsInHop = hopsMap.get(hopNum) || [];

          return (
            <div key={hopNum} className="relative">
              {/* Hop Header Marker */}
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-lg bg-sky-950 border border-sky-800 text-sky-400 font-mono text-xs font-bold">
                  HOP {hopNum} CONNECTIONS
                </span>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[11px] font-mono text-slate-500">
                  {stepsInHop.length} Transfer{stepsInHop.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Transfers in this Hop */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stepsInHop.map((step) => {
                  const isActive = activeStep?.stepNumber === step.stepNumber;
                  const isCashout = step.flowRole === 'cashout';
                  const isAdversarial = step.isAdversarial;

                  return (
                    <div
                      key={step.txHash}
                      onClick={() => onSelectStep(step)}
                      className={`relative rounded-2xl p-4 border transition cursor-pointer flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'bg-sky-950/70 border-sky-400 ring-2 ring-sky-500/30 shadow-xl shadow-sky-500/10'
                          : isAdversarial
                          ? 'bg-rose-950/20 border-rose-900/60 hover:border-rose-700'
                          : isCashout
                          ? 'bg-emerald-950/20 border-emerald-800/80 hover:border-emerald-500'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Connection Edge Details */}
                      <div>
                        {/* Transaction ID & Role Badge */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                              isAdversarial
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : isCashout
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isAdversarial
                              ? step.adversarialTag || 'ADVERSARIAL'
                              : isCashout
                              ? 'CASHOUT SINK'
                              : 'PEEL TRANSFER'}
                          </span>

                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-sky-400 font-bold">
                              {shortenAddr(step.txHash, 6)}
                            </span>
                            <button
                              onClick={(e) => handleCopy(step.txHash, e)}
                              className="text-slate-500 hover:text-white p-0.5"
                              title="Copy Tx Hash"
                            >
                              {copiedText === step.txHash ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Amount Flow */}
                        <div className="flex items-center justify-between my-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <div className="text-xs text-slate-400">
                            <span>Amount Flow:</span>
                          </div>
                          <span
                            className={`font-mono text-sm font-bold ${
                              isAdversarial
                                ? 'text-rose-400'
                                : isCashout
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {formatCrypto(step.amount, step.currency)}
                          </span>
                        </div>

                        {/* Connection Visual (From -> To) */}
                        <div className="space-y-1 text-xs font-mono pt-1">
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="text-slate-500">From:</span>
                            <span className="text-slate-300">{shortenAddr(step.fromAddress, 7)}</span>
                          </div>
                          <div className="flex items-center justify-center text-slate-600 my-0.5">
                            <ArrowDown className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="text-slate-500">To Destination:</span>
                            <span
                              className={`font-bold ${
                                isCashout
                                  ? 'text-emerald-400'
                                  : isAdversarial
                                  ? 'text-rose-400'
                                  : 'text-white'
                              }`}
                            >
                              {shortenAddr(step.toAddress, 7)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Narrative Explanation */}
                      <p className="text-[11px] text-slate-300/90 border-t border-slate-800/80 pt-2 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Step Details Bar */}
      {activeStep && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-mono text-sky-400 font-bold block">
              Currently Inspected Connection (Step {activeStep.stepNumber} of {flowSteps.length})
            </span>
            <p className="text-slate-200 font-mono">
              Tx: <strong className="text-white select-all">{activeStep.txHash}</strong> ({formatCrypto(activeStep.amount, activeStep.currency)})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              Hop Level {activeStep.hop}
            </span>
            <button
              onClick={(e) => handleCopy(activeStep.txHash, e)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs flex items-center gap-1 transition"
            >
              {copiedText === activeStep.txHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>Copy Tx Hash</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
