import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
  Shuffle,
  EyeOff,
  Flame,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { ForensicReport } from '../types';

interface ForensicReportPanelProps {
  report?: ForensicReport | null;
}

const FUNCTION_METADATA: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }> }
> = {
  peel_chain: {
    label: 'Peel Chain Detector',
    icon: Layers,
  },
  terminal_sink: {
    label: 'Terminal Sink Cash-Out',
    icon: Flame,
  },
  sanctions: {
    label: 'OFAC & Sanction Lists',
    icon: ShieldAlert,
  },
  dusting_attack: {
    label: 'Dusting Attack Vector',
    icon: AlertTriangle,
  },
  address_poisoning: {
    label: 'Address Poisoning Decoy',
    icon: EyeOff,
  },
  mixer_entropy: {
    label: 'Shannon Mixer Entropy',
    icon: Shuffle,
  },
  cluster_recombination: {
    label: 'Mule Recombination / Fan-In',
    icon: TrendingUp,
  },
  mining_origin: {
    label: 'Coinbase Mining Origin',
    icon: Sparkles,
  },
};

export const ForensicReportPanel: React.FC<ForensicReportPanelProps> = ({ report }) => {
  if (!report) return null;

  const { overall_risk, function_risks } = report;

  // Visual styling based on threat level
  const getLevelTheme = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return {
          border: 'border-rose-500/70',
          bg: 'bg-rose-950/20',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          scoreText: 'text-rose-400',
          glow: 'shadow-rose-500/10',
          icon: ShieldAlert,
        };
      case 'HIGH':
        return {
          border: 'border-amber-500/70',
          bg: 'bg-amber-950/20',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          scoreText: 'text-amber-400',
          glow: 'shadow-amber-500/10',
          icon: ShieldAlert,
        };
      case 'MEDIUM':
        return {
          border: 'border-yellow-500/60',
          bg: 'bg-yellow-950/20',
          badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          scoreText: 'text-yellow-400',
          glow: 'shadow-yellow-500/10',
          icon: AlertTriangle,
        };
      default:
        return {
          border: 'border-emerald-500/60',
          bg: 'bg-emerald-950/20',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          scoreText: 'text-emerald-400',
          glow: 'shadow-emerald-500/10',
          icon: ShieldCheck,
        };
    }
  };

  const theme = getLevelTheme(overall_risk.level);
  const StatusIcon = theme.icon;

  return (
    <div
      className={`rounded-2xl border ${theme.border} ${theme.bg} p-4 sm:p-5 shadow-xl ${theme.glow} space-y-4 transition-all`}
    >
      {/* 1. TOP HEADER: THREAT SCORE & SUMMARY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        {/* Left: Overall Threat Score Badge */}
        <div className="flex items-center gap-3.5">
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-xl border ${theme.border} bg-slate-950 shadow-inner`}
          >
            <StatusIcon className={`w-6 h-6 ${theme.scoreText}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase">
                Composite Threat Score
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${theme.badgeBg}`}
              >
                {overall_risk.level} THREAT
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-2xl sm:text-3xl font-extrabold font-mono ${theme.scoreText}`}>
                {overall_risk.score.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-500">/ 100.0</span>
            </div>
          </div>
        </div>

        {/* Right: Bayesian Evidence Saturation & Confidence Meter */}
        <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 self-start md:self-auto">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">
              Bayesian Certainty
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-bold font-mono text-sky-400">
                {overall_risk.confidence_score.toFixed(1)}%
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  overall_risk.confidence_level === 'HIGH'
                    ? 'bg-sky-950 text-sky-300 border-sky-800'
                    : overall_risk.confidence_level === 'MEDIUM'
                    ? 'bg-yellow-950 text-yellow-300 border-yellow-800'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {overall_risk.confidence_level}
              </span>
            </div>
          </div>

          <div className="w-16 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, overall_risk.confidence_score)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Forensic Verdict Narrative Summary */}
      <div className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
        <span className="font-semibold text-white mr-1.5 font-mono text-[11px] uppercase tracking-wide text-sky-400">
          Forensic Verdict:
        </span>
        {overall_risk.summary}
      </div>

      {/* 2. MODULAR FUNCTION RISK GRID */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
          <span>Active Forensic Detection Modules ({Object.keys(function_risks).length})</span>
          <span>Risk Points / Forensic Evidence</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {Object.entries(function_risks).map(([funcKey, data]) => {
            const meta = FUNCTION_METADATA[funcKey] || {
              label: funcKey.replace(/_/g, ' ').toUpperCase(),
              icon: Sparkles,
            };
            const Icon = meta.icon;
            const isFlagged = data.status === 'FLAGGED';
            const isSuspicious = data.status === 'SUSPICIOUS';

            const cardBorder = isFlagged
              ? 'border-rose-800/80 bg-rose-950/20'
              : isSuspicious
              ? 'border-amber-800/80 bg-amber-950/20'
              : 'border-slate-800/80 bg-slate-950/40';

            const badgeColor = isFlagged
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : isSuspicious
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

            return (
              <div
                key={funcKey}
                className={`rounded-xl border ${cardBorder} p-3 space-y-1.5 transition-all hover:bg-slate-900/60`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isFlagged
                          ? 'text-rose-400'
                          : isSuspicious
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-200 tracking-tight">
                      {meta.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {data.risk_score > 0 && (
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        +{data.risk_score.toFixed(0)} pts
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${badgeColor}`}
                    >
                      {data.status}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug font-sans">
                  {data.reason}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
