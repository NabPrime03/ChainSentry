import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Compass,
  Copy,
  ArrowRight
} from 'lucide-react';
import { FlowStep } from '../types';
import { formatCrypto, shortenAddr } from '../services/api';

interface FlowThroughPlayerProps {
  steps: FlowStep[];
  activeStep: FlowStep | null;
  onStepChange: (step: FlowStep) => void;
  currency: string;
}

export const FlowThroughPlayer: React.FC<FlowThroughPlayerProps> = ({
  steps,
  activeStep,
  onStepChange,
  currency,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(2500); // ms per step
  const [copiedHash, setCopiedHash] = useState(false);

  const currentIndex = steps.findIndex(
    (s) => s.stepNumber === activeStep?.stepNumber
  );

  // Auto-play timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (currentIndex < steps.length - 1) {
          onStepChange(steps[currentIndex + 1]);
        } else {
          setIsPlaying(false);
        }
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, steps, speed, onStepChange]);

  if (!steps.length || !activeStep) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1500);
  };

  const currentStep = activeStep;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-4">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Trace Playthrough (Fund Flow Walkthrough)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">
                STEP {currentStep.stepNumber} OF {steps.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Step through the transaction flow hop-by-hop from person to destination sink
            </p>
          </div>
        </div>

        {/* Playback Button Group */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {/* Restart */}
          <button
            onClick={() => {
              setIsPlaying(false);
              onStepChange(steps[0]);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/80"
            title="Restart from Hop 0 (Source)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Prev */}
          <button
            disabled={currentIndex <= 0}
            onClick={() => {
              setIsPlaying(false);
              if (currentIndex > 0) onStepChange(steps[currentIndex - 1]);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous Transfer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition active:scale-95"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play Walkthrough</span>
              </>
            )}
          </button>

          {/* Next */}
          <button
            disabled={currentIndex >= steps.length - 1}
            onClick={() => {
              setIsPlaying(false);
              if (currentIndex < steps.length - 1) onStepChange(steps[currentIndex + 1]);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Transfer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Jump to Cashout / End */}
          <button
            onClick={() => {
              setIsPlaying(false);
              onStepChange(steps[steps.length - 1]);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/80"
            title="Jump to Final Cashout Sink"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Step Progress Track Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Walkthrough Progress: {Math.round(((currentIndex + 1) / steps.length) * 100)}%</span>
          <span className="text-amber-400 font-bold">Hop {currentStep.hop} Active</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex border border-slate-800">
          {steps.map((s, idx) => {
            const isPassed = idx <= currentIndex;
            const isCurr = idx === currentIndex;
            return (
              <button
                key={s.stepNumber}
                onClick={() => {
                  setIsPlaying(false);
                  onStepChange(s);
                }}
                className={`flex-1 h-full transition-all ${
                  isCurr
                    ? 'bg-amber-400 animate-pulse'
                    : isPassed
                    ? s.isAdversarial
                      ? 'bg-rose-500'
                      : s.flowRole === 'cashout'
                      ? 'bg-emerald-400'
                      : 'bg-sky-500'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
                title={`Step ${s.stepNumber}: ${formatCrypto(s.amount, s.currency)}`}
              />
            );
          })}
        </div>
      </div>

      {/* Active Step Narrative Spotlight Card */}
      <div
        className={`p-4 rounded-xl border transition ${
          currentStep.isAdversarial
            ? 'bg-rose-950/30 border-rose-800/80'
            : currentStep.flowRole === 'cashout'
            ? 'bg-emerald-950/30 border-emerald-800/80'
            : 'bg-slate-950/80 border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                  currentStep.isAdversarial
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : currentStep.flowRole === 'cashout'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                }`}
              >
                {currentStep.flowRole.toUpperCase().replace('_', ' ')}
              </span>

              <span className="text-xs text-slate-400 font-mono">
                TX: <code className="text-white font-bold">{currentStep.txHash}</code>
              </span>

              <button
                onClick={() => handleCopy(currentStep.txHash)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                title="Copy Transaction Hash"
              >
                <Copy className="w-3 h-3" />
              </button>
              {copiedHash && (
                <span className="text-[10px] text-emerald-400 font-mono">Copied!</span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-200 leading-relaxed pt-1">
              {currentStep.description}
            </p>
          </div>

          {/* Amount Badge */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-right shrink-0">
            <span className="text-[10px] text-slate-500 font-mono block">Transfer Value</span>
            <span
              className={`text-base font-bold font-mono ${
                currentStep.isAdversarial
                  ? 'text-rose-400'
                  : currentStep.flowRole === 'cashout'
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {formatCrypto(currentStep.amount, currentStep.currency)}
            </span>
          </div>
        </div>

        {/* Sender -> Recipient Address Journey */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">From Person / Wallet:</span>
            <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-bold">
              {shortenAddr(currentStep.fromAddress, 8)}
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-slate-500">To Destination:</span>
            <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-bold">
              {shortenAddr(currentStep.toAddress, 8)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
