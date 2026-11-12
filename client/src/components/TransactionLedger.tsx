import React, { useState } from 'react';
import {
  Copy,
  Check,
  ShieldAlert,
  Coins
} from 'lucide-react';
import { Transaction } from '../types';
import { formatCrypto, shortenAddr } from '../services/api';

interface TransactionLedgerProps {
  transactions: Transaction[];
  onSelectTx: (tx: Transaction) => void;
  selectedTx?: Transaction | null;
  currency: string;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  onSelectTx,
  selectedTx,
  currency,
}) => {
  const [filter, setFilter] = useState<'all' | 'genuine' | 'adversarial'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filtered = transactions.filter((tx) => {
    if (filter === 'genuine' && tx.is_adversarial) return false;
    if (filter === 'adversarial' && !tx.is_adversarial) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        tx.tx_hash.toLowerCase().includes(term) ||
        tx.from_address.toLowerCase().includes(term) ||
        tx.to_address.toLowerCase().includes(term) ||
        (tx.adversarial_tag && tx.adversarial_tag.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Forensic Transaction Ledger</h3>
            <p className="text-[11px] text-slate-400">
              Showing {filtered.length} of {transactions.length} recorded edge transfers
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2">
          {/* Quick Filter Tabs */}
          <div className="flex items-center rounded-lg bg-slate-800/80 p-0.5 text-xs font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition ${
                filter === 'all'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setFilter('genuine')}
              className={`px-2.5 py-1 rounded-md transition ${
                filter === 'genuine'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Genuine
            </button>
            <button
              onClick={() => setFilter('adversarial')}
              className={`px-2.5 py-1 rounded-md transition ${
                filter === 'adversarial'
                  ? 'bg-rose-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Adversarial
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search hash or address..."
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Transaction ID (Hash)</th>
              <th className="px-4 py-3">Sender (Person / Origin)</th>
              <th className="px-4 py-3">Recipient (Destination)</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Fee</th>
              <th className="px-4 py-3 text-center">Status / Tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((tx) => {
              const isSelected = selectedTx?.tx_hash === tx.tx_hash;

              return (
                <tr
                  key={tx.tx_hash}
                  onClick={() => onSelectTx(tx)}
                  className={`cursor-pointer transition ${
                    isSelected
                      ? 'bg-sky-950/50 hover:bg-sky-900/50'
                      : tx.is_adversarial
                      ? 'bg-rose-950/10 hover:bg-rose-950/20'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  {/* Tx Hash */}
                  <td className="px-4 py-3 font-semibold text-sky-400">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[140px]">{tx.tx_hash}</span>
                      <button
                        onClick={(e) => handleCopy(tx.tx_hash, tx.tx_hash, e)}
                        className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition"
                        title="Copy Tx Hash"
                      >
                        {copiedId === tx.tx_hash ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* From Address */}
                  <td className="px-4 py-3 text-slate-300">
                    <span title={tx.from_address}>{shortenAddr(tx.from_address, 7)}</span>
                  </td>

                  {/* To Address */}
                  <td className="px-4 py-3 text-slate-300">
                    <span title={tx.to_address}>{shortenAddr(tx.to_address, 7)}</span>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 text-right font-bold text-white">
                    <span
                      className={
                        tx.is_adversarial
                          ? 'text-rose-400'
                          : tx.amount >= 10
                          ? 'text-amber-400'
                          : 'text-slate-100'
                      }
                    >
                      {formatCrypto(tx.amount, tx.currency)}
                    </span>
                  </td>

                  {/* Fee */}
                  <td className="px-4 py-3 text-right text-slate-400">
                    {tx.fee ? formatCrypto(tx.fee, tx.currency) : '0.00'}
                  </td>

                  {/* Status / Flag */}
                  <td className="px-4 py-3 text-center">
                    {tx.is_adversarial ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/80">
                        <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />
                        <span>{tx.adversarial_tag || 'ADVERSARIAL'}</span>
                      </span>
                    ) : tx.to_address.toLowerCase().includes('exchange') ||
                      tx.to_address.toLowerCase().includes('binance') ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                        CASHOUT
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        NORMAL FLOW
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
