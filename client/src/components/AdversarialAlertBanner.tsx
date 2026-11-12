import React from 'react';
import { ShieldAlert, AlertTriangle, EyeOff, CheckCircle } from 'lucide-react';
import { Transaction } from '../types';
import { shortenAddr } from '../services/api';

interface AdversarialAlertBannerProps {
  transactions: Transaction[];
}

export const AdversarialAlertBanner: React.FC<AdversarialAlertBannerProps> = ({
  transactions,
}) => {
  const adversarialTxs = transactions.filter((tx) => tx.is_adversarial);
  if (!adversarialTxs.length) return null;

  const dustingTxs = adversarialTxs.filter((tx) =>
    tx.adversarial_tag?.includes('DUST')
  );
  const poisoningTxs = adversarialTxs.filter((tx) =>
    tx.adversarial_tag?.includes('POISON')
  );

  return (
    <div className="bg-rose-950/30 border border-rose-800/80 rounded-2xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-200 tracking-tight flex items-center gap-2">
              <span>Adversarial Trace Manipulation Detected</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-900/80 text-rose-300 font-bold border border-rose-700">
                {adversarialTxs.length} ATTACK VECTORS
              </span>
            </h4>
            <p className="text-xs text-rose-300/80">
              Adversaries are actively attempting to corrupt graph traversal and forensic clustering heuristics.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {dustingTxs.length > 0 && (
          <div className="bg-slate-950/70 border border-rose-900/60 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Dusting Attack Vector ({dustingTxs.length})</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">Deanonymization</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Adversary transmitted negligible micro-amounts ({dustingTxs[0].amount} {dustingTxs[0].currency}) to victim{' '}
              <code className="text-amber-300">{shortenAddr(dustingTxs[0].to_address)}</code> to monitor address clustering when unspent outputs are combined.
            </p>
            <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 pt-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span>ChainSentry Defense: Flagged and isolated from genuine main-trunk flow.</span>
            </div>
          </div>
        )}

        {poisoningTxs.length > 0 && (
          <div className="bg-slate-950/70 border border-rose-900/60 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-300 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Address Poisoning Attack ({poisoningTxs.length})</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">History Spoofing</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Zero-value transfer executed to vanity spoofed address{' '}
              <code className="text-amber-300">{shortenAddr(poisoningTxs[0].to_address)}</code> matching prefix/suffix characters to bait copy-paste theft.
            </p>
            <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 pt-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span>ChainSentry Defense: Identified zero-value weight and marked decoy edge.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
