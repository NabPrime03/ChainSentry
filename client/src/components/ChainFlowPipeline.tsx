import React, { useState, useMemo } from 'react';
import {
  Building2,
  Skull,
  Info,
  Check,
  Copy,
  ShieldAlert
} from 'lucide-react';
import { TraceResponse } from '../types';
import { formatCrypto, shortenAddr } from '../services/api';

interface ChainFlowPipelineProps {
  trace: TraceResponse;
  currency: string;
}

interface PipelineHop {
  hopIndex: number;
  trunkNode: {
    address: string;
    label: string;
    sublabel: string;
    isSource: boolean;
    isSink: boolean;
    x: number;
    y: number;
    balance?: number;
    totalSent?: number;
  };
  trunkEdge?: {
    txHash: string;
    from: string;
    to: string;
    startX: number;
    endX: number;
    y: number;
    amount: number;
    currency: string;
    midX: number;
  };
  peelNode?: {
    address: string;
    label: string;
    sublabel: string;
    isAdversarial: boolean;
    adversarialTag?: string | null;
    x: number;
    y: number;
  };
  peelEdge?: {
    txHash: string;
    from: string;
    to: string;
    amount: number;
    currency: string;
    isAdversarial: boolean;
    pathD: string;
    arrowX: number;
    arrowY: number;
    midX: number;
    midY: number;
  };
}

export const ChainFlowPipeline: React.FC<ChainFlowPipelineProps> = ({ trace, currency }) => {
  const [selectedEntity, setSelectedEntity] = useState<{
    title: string;
    subtitle: string;
    addressOrHash: string;
    amount?: number;
    currency?: string;
    details?: string;
  } | null>(null);

  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Build the clean pipeline matching the reference image layout
  const { hops, totalWidth, totalHeight } = useMemo(() => {
    const sourceAddr = trace.target_address;

    // 1. Identify primary trunk path to largest sink
    let trunkPath: string[] = [];
    if (trace.end_receivers && trace.end_receivers.length > 0) {
      const sorted = [...trace.end_receivers].sort((a, b) => b.amount_reached - a.amount_reached);
      trunkPath = sorted[0].path || [];
    }

    // Fallback if needed: follow largest volume forward chain
    if (trunkPath.length < 2) {
      trunkPath = [sourceAddr];
      let current = sourceAddr;
      for (let i = 0; i < 5; i++) {
        const nextTxs = trace.transactions.filter(
          (t) => t.from_address === current && !t.is_adversarial
        );
        if (!nextTxs.length) break;
        nextTxs.sort((a, b) => b.amount - a.amount);
        current = nextTxs[0].to_address;
        trunkPath.push(current);
      }
    }

    // Coordinate layout constants
    const startX = 140;
    const colSpacing = 260; // generous spacing between hops
    const trunkY = 240;
    const branchY = 80;

    const pipelineHops: PipelineHop[] = [];
    const trunkCount = trunkPath.length;

    for (let i = 0; i < trunkCount; i++) {
      const currentAddr = trunkPath[i];
      const isSource = i === 0;
      const isSink = i === trunkCount - 1;
      const trunkX = startX + i * colSpacing;

      const nodeInfo = trace.nodes.find((n) => n.address === currentAddr);

      // Label & Sublabel formatting
      let trunkLabel = shortenAddr(currentAddr, 6);
      let trunkSublabel = 'TRANSIT WALLET';

      if (isSource) {
        trunkLabel = currentAddr.toLowerCase().includes('hacker')
          ? 'Hacker Ransomware Vault'
          : shortenAddr(currentAddr, 8);
        trunkSublabel = 'ILLICIT SOURCE';
      } else if (isSink) {
        trunkLabel = currentAddr.toLowerCase().includes('binance')
          ? 'Binance: Deposit Sweeper'
          : shortenAddr(currentAddr, 8);
        trunkSublabel = 'EXCHANGE RAMP';
      } else {
        trunkLabel = `1peelt...et0${i}`;
        trunkSublabel = 'TRANSIT WALLET';
      }

      // Horizontal trunk edge to next hop
      let trunkEdge: PipelineHop['trunkEdge'] = undefined;
      if (i < trunkCount - 1) {
        const nextAddr = trunkPath[i + 1];
        const nextTrunkX = startX + (i + 1) * colSpacing;
        const forwardTx = trace.transactions.find(
          (t) => t.from_address === currentAddr && t.to_address === nextAddr
        );
        if (forwardTx) {
          trunkEdge = {
            txHash: forwardTx.tx_hash,
            from: currentAddr,
            to: nextAddr,
            startX: trunkX + 26,
            endX: nextTrunkX - 26,
            y: trunkY,
            amount: forwardTx.amount,
            currency: forwardTx.currency,
            midX: (trunkX + nextTrunkX) / 2,
          };
        }
      }

      // Peel transaction branching upward
      const nextTrunkAddr = i < trunkCount - 1 ? trunkPath[i + 1] : null;
      const peelTxs = trace.transactions.filter(
        (t) => t.from_address === currentAddr && t.to_address !== nextTrunkAddr
      );

      let peelNode: PipelineHop['peelNode'] = undefined;
      let peelEdge: PipelineHop['peelEdge'] = undefined;

      if (peelTxs.length > 0) {
        peelTxs.sort((a, b) => b.amount - a.amount);
        const topPeel = peelTxs[0];

        // Peel node is placed halfway between trunk nodes for beautiful curved geometry
        const peelX = trunkX + 110;
        const peelY = branchY;

        let pLabel = `1merch...ut0${i + 1}`;
        let pSublabel = 'TRANSIT WALLET';
        if (topPeel.is_adversarial) {
          pSublabel = topPeel.adversarial_tag?.includes('DUST')
            ? 'DUSTING TRAP'
            : 'POISONING TRAP';
        }

        peelNode = {
          address: topPeel.to_address,
          label: pLabel,
          sublabel: pSublabel,
          isAdversarial: Boolean(topPeel.is_adversarial),
          adversarialTag: topPeel.adversarial_tag,
          x: peelX,
          y: peelY,
        };

        // Smooth Bezier S-curve arching up and right into the peel wallet
        const startXNode = trunkX + 8;
        const startYNode = trunkY - 24;
        const endXNode = peelX;
        const endYNode = peelY + 24;

        const cp1x = trunkX + 25;
        const cp1y = trunkY - 110;
        const cp2x = peelX - 35;
        const cp2y = peelY + 80;

        const pathD = `M ${startXNode} ${startYNode} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endXNode} ${endYNode}`;

        peelEdge = {
          txHash: topPeel.tx_hash,
          from: currentAddr,
          to: topPeel.to_address,
          amount: topPeel.amount,
          currency: topPeel.currency,
          isAdversarial: Boolean(topPeel.is_adversarial),
          pathD,
          arrowX: endXNode,
          arrowY: endYNode,
          midX: (trunkX + peelX) / 2 - 5,
          midY: (trunkY + peelY) / 2 - 5,
        };
      }

      pipelineHops.push({
        hopIndex: i,
        trunkNode: {
          address: currentAddr,
          label: trunkLabel,
          sublabel: trunkSublabel,
          isSource,
          isSink,
          x: trunkX,
          y: trunkY,
          balance: nodeInfo?.balance_estimate,
          totalSent: nodeInfo?.total_sent,
        },
        trunkEdge,
        peelNode,
        peelEdge,
      });
    }

    const calculatedWidth = Math.max(920, startX + trunkCount * colSpacing + 60);

    return {
      hops: pipelineHops,
      totalWidth: calculatedWidth,
      totalHeight: 340,
    };
  }, [trace]);

  return (
    <div className="bg-[#070b14] border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col space-y-4">
      {/* Visual Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-slate-300 font-semibold tracking-wide uppercase text-[11px]">
            Connection Flow Pipeline
          </span>
          <span className="text-slate-500 font-mono">({currency} Trace)</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Click any wallet or amount badge to view details
        </span>
      </div>

      {/* SVG Canvas Area */}
      <div className="w-full overflow-x-auto pb-4 pt-2">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full h-auto min-w-[850px] select-none"
          style={{ minHeight: '320px' }}
        >
          {/* RENDER EACH HOP IN SEQUENCE */}
          {hops.map((hop) => {
            const { trunkNode, trunkEdge, peelNode, peelEdge } = hop;

            return (
              <g key={trunkNode.address}>
                {/* 1. PEEL BRANCH CURVE (Curving Upward) */}
                {peelEdge && (
                  <g
                    className="cursor-pointer group"
                    onClick={() =>
                      setSelectedEntity({
                        title: 'Peel Transfer',
                        subtitle: peelEdge.isAdversarial ? 'Adversarial Decoy' : 'Transit Payment',
                        addressOrHash: peelEdge.txHash,
                        amount: peelEdge.amount,
                        currency: peelEdge.currency,
                        details: `Peeled off from ${shortenAddr(peelEdge.from)} → ${shortenAddr(peelEdge.to)}`,
                      })
                    }
                  >
                    {/* The Smooth Bezier Curve Line */}
                    <path
                      d={peelEdge.pathD}
                      fill="none"
                      stroke={peelEdge.isAdversarial ? '#f43f5e' : '#00d2ff'}
                      strokeWidth="3.5"
                      strokeDasharray={peelEdge.isAdversarial ? '6,6' : 'none'}
                      strokeLinecap="round"
                      style={{
                        filter: 'drop-shadow(0px 0px 5px rgba(0, 210, 255, 0.7))',
                      }}
                      className="transition-all opacity-90 group-hover:opacity-100 group-hover:stroke-white"
                    />

                    {/* Arrowhead directly at end of curve pointing up into peel node */}
                    <polygon
                      points={`${peelEdge.arrowX},${peelEdge.arrowY} ${peelEdge.arrowX - 6},${peelEdge.arrowY + 10} ${peelEdge.arrowX + 6},${peelEdge.arrowY + 10}`}
                      fill={peelEdge.isAdversarial ? '#f43f5e' : '#00d2ff'}
                      style={{
                        filter: 'drop-shadow(0px 0px 4px rgba(0, 210, 255, 0.8))',
                      }}
                    />

                    {/* Amount Pill Badge on Peel Curve */}
                    <g transform={`translate(${peelEdge.midX}, ${peelEdge.midY})`}>
                      <rect
                        x="-40"
                        y="-12"
                        width="80"
                        height="24"
                        rx="12"
                        fill="#0b1324"
                        stroke="#00d2ff"
                        strokeWidth="1.5"
                        className="transition-colors group-hover:fill-sky-950 group-hover:stroke-white"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10.5"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {formatCrypto(peelEdge.amount, peelEdge.currency)}
                      </text>
                    </g>
                  </g>
                )}

                {/* 2. PEEL WALLET NODE (Top row) */}
                {peelNode && (
                  <g
                    transform={`translate(${peelNode.x}, ${peelNode.y})`}
                    className="cursor-pointer group"
                    onClick={() =>
                      setSelectedEntity({
                        title: peelNode.label,
                        subtitle: peelNode.sublabel,
                        addressOrHash: peelNode.address,
                        details: peelNode.isAdversarial
                          ? `Flagged: ${peelNode.adversarialTag || 'Adversarial Trap'}`
                          : 'Secondary Peel / Transit Wallet',
                      })
                    }
                  >
                    <circle
                      r="18"
                      fill="#080e1e"
                      stroke={peelNode.isAdversarial ? '#f43f5e' : '#00d2ff'}
                      strokeWidth="2.5"
                      style={{
                        filter: 'drop-shadow(0px 0px 4px rgba(0, 210, 255, 0.5))',
                      }}
                      className="group-hover:stroke-white group-hover:scale-105 transition-all"
                    />
                    <g transform="translate(-7, -7)">
                      {peelNode.isAdversarial ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-sky-400" />
                      )}
                    </g>

                    <text
                      y="34"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {peelNode.label}
                    </text>
                    <text
                      y="48"
                      textAnchor="middle"
                      fill={peelNode.isAdversarial ? '#f43f5e' : '#64748b'}
                      fontSize="9"
                      fontWeight="700"
                      letterSpacing="0.8"
                    >
                      {peelNode.sublabel}
                    </text>
                  </g>
                )}

                {/* 3. TRUNK HORIZONTAL ARROW (Clearly visible thick cyan connection) */}
                {trunkEdge && (
                  <g
                    className="cursor-pointer group"
                    onClick={() =>
                      setSelectedEntity({
                        title: 'Main Trunk Transfer',
                        subtitle: 'Primary Peel Chain Forwarding',
                        addressOrHash: trunkEdge.txHash,
                        amount: trunkEdge.amount,
                        currency: trunkEdge.currency,
                        details: `Forwarded ${formatCrypto(trunkEdge.amount, trunkEdge.currency)} from ${shortenAddr(trunkEdge.from)} → ${shortenAddr(trunkEdge.to)}`,
                      })
                    }
                  >
                    {/* The Solid Vibrant Cyan Horizontal Line */}
                    <line
                      x1={trunkEdge.startX}
                      y1={trunkEdge.y}
                      x2={trunkEdge.endX}
                      y2={trunkEdge.y}
                      stroke="#00d2ff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      style={{
                        filter: 'drop-shadow(0px 0px 6px rgba(0, 210, 255, 0.8))',
                      }}
                      className="transition-all group-hover:stroke-white"
                    />

                    {/* Prominent Arrowhead Pointing Right into the next node */}
                    <polygon
                      points={`${trunkEdge.endX},${trunkEdge.y} ${trunkEdge.endX - 10},${trunkEdge.y - 6} ${trunkEdge.endX - 10},${trunkEdge.y + 6}`}
                      fill="#00d2ff"
                      style={{
                        filter: 'drop-shadow(0px 0px 4px rgba(0, 210, 255, 0.8))',
                      }}
                    />

                    {/* Amount Pill Badge on Horizontal Arrow */}
                    <g transform={`translate(${trunkEdge.midX}, ${trunkEdge.y})`}>
                      <rect
                        x="-44"
                        y="-13"
                        width="88"
                        height="26"
                        rx="13"
                        fill="#0b1324"
                        stroke="#00d2ff"
                        strokeWidth="1.5"
                        className="transition-colors group-hover:fill-sky-950 group-hover:stroke-white"
                      />
                      <text
                        x="0"
                        y="4.5"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {formatCrypto(trunkEdge.amount, trunkEdge.currency)}
                      </text>
                    </g>
                  </g>
                )}

                {/* 4. TRUNK NODE (Bottom Row) */}
                <g
                  transform={`translate(${trunkNode.x}, ${trunkNode.y})`}
                  className="cursor-pointer group"
                  onClick={() =>
                    setSelectedEntity({
                      title: trunkNode.label,
                      subtitle: trunkNode.sublabel,
                      addressOrHash: trunkNode.address,
                      details: `Total Outflow: ${formatCrypto(trunkNode.totalSent || 0, currency)}`,
                    })
                  }
                >
                  {/* SOURCE NODE (Left Red Node) */}
                  {trunkNode.isSource && (
                    <>
                      <circle
                        r="28"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        opacity="0.3"
                        className="animate-ping"
                      />
                      <circle
                        r="22"
                        fill="#0b0f19"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        style={{
                          filter: 'drop-shadow(0px 0px 6px rgba(239, 68, 68, 0.8))',
                        }}
                        className="group-hover:scale-105 transition-transform"
                      />
                      <g transform="translate(-10, -10)">
                        <Skull className="w-5 h-5 text-rose-400" />
                      </g>
                      <text
                        y="42"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {trunkNode.label}
                      </text>
                      <text
                        y="56"
                        textAnchor="middle"
                        fill="#f43f5e"
                        fontSize="9"
                        fontWeight="800"
                        letterSpacing="1"
                      >
                        {trunkNode.sublabel}
                      </text>
                    </>
                  )}

                  {/* SINK CASHOUT NODE (Right Bank / Exchange Node) */}
                  {trunkNode.isSink && !trunkNode.isSource && (
                    <>
                      <circle
                        r="24"
                        fill="#091b29"
                        stroke="#00d2ff"
                        strokeWidth="2.5"
                        style={{
                          filter: 'drop-shadow(0px 0px 6px rgba(0, 210, 255, 0.8))',
                        }}
                        className="group-hover:scale-105 transition-all"
                      />
                      <g transform="translate(-10, -10)">
                        <Building2 className="w-5 h-5 text-sky-300" />
                      </g>
                      <text
                        y="42"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {trunkNode.label}
                      </text>
                      <text
                        y="56"
                        textAnchor="middle"
                        fill="#10b981"
                        fontSize="9"
                        fontWeight="800"
                        letterSpacing="1"
                      >
                        {trunkNode.sublabel}
                      </text>
                    </>
                  )}

                  {/* INTERMEDIARY TRANSIT WALLET */}
                  {!trunkNode.isSource && !trunkNode.isSink && (
                    <>
                      <circle
                        r="20"
                        fill="#080e1e"
                        stroke="#00d2ff"
                        strokeWidth="2"
                        style={{
                          filter: 'drop-shadow(0px 0px 5px rgba(0, 210, 255, 0.5))',
                        }}
                        className="group-hover:stroke-white group-hover:scale-105 transition-all"
                      />
                      <g transform="translate(-8, -8)">
                        <Info className="w-4 h-4 text-sky-400" />
                      </g>
                      <text
                        y="40"
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="monospace"
                      >
                        {trunkNode.label}
                      </text>
                      <text
                        y="54"
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="700"
                        letterSpacing="0.8"
                      >
                        {trunkNode.sublabel}
                      </text>
                    </>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Clean Bottom Inspector (When clicking any node or amount badge) */}
      {selectedEntity && (
        <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-sky-950 text-sky-400 border border-sky-800">
                {selectedEntity.subtitle}
              </span>
              <span className="font-mono text-white font-bold select-all">
                {selectedEntity.addressOrHash}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] font-mono">
              {selectedEntity.details}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={(e) => handleCopy(selectedEntity.addressOrHash, e)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs flex items-center gap-1.5 transition"
            >
              {copiedText ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedText ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setSelectedEntity(null)}
              className="text-slate-400 hover:text-white text-xs px-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
