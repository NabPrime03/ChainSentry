import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, X, Check, Copy } from 'lucide-react';
import { TraceResponse } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trace: TraceResponse;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  trace,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(trace, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chainsentry_trace_${trace.target_address}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const headers = [
      'tx_hash',
      'from_address',
      'to_address',
      'amount',
      'currency',
      'timestamp',
      'fee',
      'is_adversarial',
      'adversarial_tag',
    ];
    const rows = trace.transactions.map((tx) => [
      `"${tx.tx_hash}"`,
      `"${tx.from_address}"`,
      `"${tx.to_address}"`,
      tx.amount,
      `"${tx.currency}"`,
      tx.timestamp,
      tx.fee ?? 0,
      tx.is_adversarial ? 'TRUE' : 'FALSE',
      `"${tx.adversarial_tag || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join(
      '\n'
    );
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chainsentry_ledger_${trace.target_address}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-semibold text-white">Export Forensic Intelligence</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400">
            Export the complete reconstructed multi-hop transaction graph, adversarial threat detections,
            and end-receiver summaries for external intelligence sharing.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleDownloadJSON}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-850 text-left transition group space-y-1"
            >
              <FileJson className="w-6 h-6 text-sky-400 group-hover:scale-110 transition" />
              <span className="font-semibold text-xs text-white block">Download JSON Dossier</span>
              <span className="text-[10px] text-slate-500 block">Complete structured graph schema</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-850 text-left transition group space-y-1"
            >
              <FileSpreadsheet className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition" />
              <span className="font-semibold text-xs text-white block">Download CSV Ledger</span>
              <span className="text-[10px] text-slate-500 block">Tabular transaction record</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={handleCopyJSON}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Copied JSON Dossier!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy JSON to Clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
