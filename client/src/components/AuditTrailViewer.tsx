import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Hash, ChevronDown, ChevronRight, Copy, Check, Clock } from 'lucide-react';
import { AuditTrailSummary } from '../types';
import { shortenAddr } from '../services/api';

interface AuditTrailViewerProps {
  auditTrail?: AuditTrailSummary | null;
  targetAddress: string;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ auditTrail, targetAddress }) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!auditTrail || !auditTrail.steps || auditTrail.steps.length === 0) {
    return (
      <div className="bg-[#070b14] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
        <Hash className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm font-semibold text-slate-300">No Cryptographic Audit Trail Available</p>
        <p className="text-xs">Run a forensic trace to generate an append-only SHA-256 hash chain of custody.</p>
      </div>
    );
  }

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  return (
    <div className="bg-[#070b14] border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-5 animate-fadeIn">
      {/* Top Chain Verification Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/70">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            auditTrail.is_valid_chain
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 shadow-lg shadow-emerald-950/20'
              : 'bg-rose-950/40 text-rose-400 border-rose-800/60'
          }`}>
            {auditTrail.is_valid_chain ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Cryptographic SHA-256 Audit Trail
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                auditTrail.is_valid_chain
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {auditTrail.is_valid_chain ? 'Chain-of-Custody Verified' : 'Integrity Compromised'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Target: <span className="text-slate-300">{shortenAddr(targetAddress, 10)}</span> • {auditTrail.total_steps} Recorded Forensic Decisions
            </p>
          </div>
        </div>

        {/* Latest Audit Hash Pill */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 font-mono">Latest Hash:</span>
          <span className="text-[11px] font-mono text-sky-400 select-all font-semibold">
            {auditTrail.latest_audit_hash.slice(0, 10)}...{auditTrail.latest_audit_hash.slice(-8)}
          </span>
          <button
            onClick={(e) => handleCopy(auditTrail.latest_audit_hash, e)}
            className="p-1 text-slate-400 hover:text-white transition"
            title="Copy full SHA-256 root hash"
          >
            {copiedHash === auditTrail.latest_audit_hash ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Step by Step Timeline */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {auditTrail.steps.map((step) => {
          const isExpanded = expandedStep === step.step_number;
          const isStop = step.step_type === 'STOPPING_CONDITION';
          const isIngest = step.step_type.includes('INGESTION');
          const isNode = step.step_type === 'NODE_VISITED';

          let typeColor = 'bg-slate-800 text-slate-300 border-slate-700';
          if (isStop) typeColor = 'bg-amber-950/50 text-amber-300 border-amber-800';
          else if (isIngest) typeColor = 'bg-sky-950/50 text-sky-300 border-sky-800';
          else if (isNode) typeColor = 'bg-indigo-950/50 text-indigo-300 border-indigo-800';

          return (
            <div
              key={step.step_number}
              onClick={() => setExpandedStep(isExpanded ? null : step.step_number)}
              className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl p-3 cursor-pointer transition select-none"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                    {step.step_number}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${typeColor}`}>
                    {step.step_type}
                  </span>
                  <span className="text-xs font-mono text-slate-200">
                    {shortenAddr(step.node_address, 8)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Hop {step.hop_depth}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 hidden sm:flex">
                    <Clock className="w-3 h-3" />
                    {new Date(step.timestamp * 1000).toLocaleTimeString()}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Hash Chain Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">PREVIOUS HASH:</span>
                      <span className="text-slate-400 truncate block">{step.prev_hash}</span>
                    </div>
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-emerald-500 block text-[10px]">STEP HASH (SHA-256):</span>
                      <span className="text-emerald-400 truncate block">{step.step_hash}</span>
                    </div>
                  </div>

                  {step.details && Object.keys(step.details).length > 0 && (
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                      <span className="text-slate-500 block mb-1 text-[10px]">FORENSIC DETAILS:</span>
                      <pre className="text-sky-300 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
