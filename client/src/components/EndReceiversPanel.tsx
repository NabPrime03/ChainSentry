import React from 'react';
import { Target, ArrowRight, CheckCircle2, Building } from 'lucide-react';
import { EndReceiverSummary } from '../types';
import { formatCrypto, shortenAddr } from '../services/api';

interface EndReceiversPanelProps {
  receivers: EndReceiverSummary[];
  currency: string;
}

export const EndReceiversPanel: React.FC<EndReceiversPanelProps> = ({
  receivers,
  currency,
}) => {
  if (!receivers.length) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Discovered Destination Sinks & Cash-Outs</h3>
            <p className="text-[11px] text-slate-400">
              Wallets where fund traversal terminates or reaches centralized off-ramps
            </p>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
          {receivers.length} Identified Sinks
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {receivers.map((sink, idx) => {
          const isExchange =
            sink.address.toLowerCase().includes('binance') ||
            sink.address.toLowerCase().includes('exchange');

          return (
            <div
              key={idx}
              className="bg-slate-950/70 border border-slate-800 hover:border-emerald-600/60 rounded-xl p-4 transition space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isExchange
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {isExchange ? (
                      <Building className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white font-mono block">
                      {shortenAddr(sink.address, 10)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Reached at Hop Depth: <strong className="text-sky-400">{sink.hop_depth}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-mono block">Amount Reached</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {formatCrypto(sink.amount_reached, currency)}
                  </span>
                </div>
              </div>

              {/* Hop Path Trail */}
              {sink.path && sink.path.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">
                    Forensic Path ({sink.path.length} Wallets):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    {sink.path.map((stepAddr, pIdx) => (
                      <React.Fragment key={pIdx}>
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            pIdx === 0
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                              : pIdx === sink.path.length - 1
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800 font-bold'
                              : 'bg-slate-900 text-slate-300 border-slate-800'
                          }`}
                          title={stepAddr}
                        >
                          {shortenAddr(stepAddr, 4)}
                        </span>
                        {pIdx < sink.path.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
