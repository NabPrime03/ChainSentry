import React, { useState, useMemo } from 'react';
import {
  Building2,
  Skull,
  Info,
  Check,
  Copy,
  ShieldAlert
} from 'lucide-react';
import { TraceResponse, Transaction } from '../types';
import { formatCrypto, shortenAddr } from '../services/api';

interface ChainFlowPipelineProps {
  trace: TraceResponse;
  currency: string;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  type: 'source' | 'trunk' | 'branch' | 'sink';
  label: string;
  sublabel: string;
  amount?: number;
  totalSent?: number;
  balance?: number;
  isAdversarial?: boolean;
  adversarialTag?: string | null;
}

interface LayoutEdge {
  txHash: string;
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  amount: number;
  currency: string;
  isTrunk: boolean;
  isAdversarial?: boolean;
  adversarialTag?: string | null;
  midX: number;
  midY: number;
  pathD: string;
}

export const ChainFlowPipeline: React.FC<ChainFlowPipelineProps> = ({ trace, currency }) => {
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'node' | 'edge';
    data: any;
  } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Compute Layout matching the user's diagram
  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const sourceAddr = trace.target_address;

    // 1. Identify primary trunk path to main sink
    // Prefer the end_receiver with highest amount or longest path
    let trunkPath: string[] = [];
    if (trace.end_receivers && trace.end_receivers.length > 0) {
      // Pick end receiver with largest cashout or sink flag
      const sortedSinks = [...trace.end_receivers].sort(
        (a, b) => b.amount_reached - a.amount_reached
      );
      trunkPath = sortedSinks[0].path || [];
    }

    // Fallback if no explicit path
    if (trunkPath.length < 2) {
      trunkPath = [sourceAddr];
      let curr = sourceAddr;
      for (let i = 0; i < 4; i++) {
        const nextTxs = trace.transactions.filter(
          (t) => t.from_address === curr && !t.is_adversarial
        );
        if (!nextTxs.length) break;
        // pick highest amount
        nextTxs.sort((a, b) => b.amount - a.amount);
        curr = nextTxs[0].to_address;
        trunkPath.push(curr);
      }
    }

    const trunkSet = new Set(trunkPath);
    const trunkCount = trunkPath.length;

    // Positioning
    const startX = 140;
    const stepX = 220;
    const trunkY = 240;
    const branchY = 70;
    const width = Math.max(950, startX + trunkCount * stepX + 100);
    const height = 360;

    const layoutNodes: LayoutNode[] = [];
    const layoutEdges: LayoutEdge[] = [];
    const nodeCoords = new Map<string, { x: number; y: number }>();

    // Place trunk nodes
    trunkPath.forEach((addr, idx) => {
      const x = startX + idx * stepX;
      const y = trunkY;
      nodeCoords.set(addr, { x, y });

      const nodeInfo = trace.nodes.find((n) => n.address === addr);
      const isSource = idx === 0;
      const isSink = idx === trunkCount - 1;

      let label = shortenAddr(addr, 6);
      let sublabel = 'TRANSIT WALLET';
      let type: LayoutNode['type'] = 'trunk';

      if (isSource) {
        type = 'source';
        label = addr.toLowerCase().includes('hacker')
          ? 'Hacker Vault'
          : shortenAddr(addr, 8);
        sublabel = 'ILLICIT SOURCE';
      } else if (isSink) {
        type = 'sink';
        label = addr.toLowerCase().includes('binance')
          ? 'Binance: Deposit Sweeper'
          : shortenAddr(addr, 8);
        sublabel = 'EXCHANGE RAMP';
      } else {
        label = `1peelt...et0${idx}`;
        sublabel = 'TRANSIT WALLET';
      }

      layoutNodes.push({
        id: addr,
        x,
        y,
        type,
        label,
        sublabel,
        totalSent: nodeInfo?.total_sent,
        balance: nodeInfo?.balance_estimate,
      });
    });

    // Place branch / peel nodes curving upward
    const branchCounter = new Map<string, number>();
    const branchNodesList: string[] = [];

    trace.transactions.forEach((tx) => {
      if (trunkSet.has(tx.from_address) && !trunkSet.has(tx.to_address)) {
        if (!nodeCoords.has(tx.to_address)) {
          const fromCoord = nodeCoords.get(tx.from_address)!;
          const count = branchCounter.get(tx.from_address) || 0;
          branchCounter.set(tx.from_address, count + 1);

          // Shift slightly right of the trunk node
          const x = fromCoord.x + 80 + count * 50;
          const y = branchY;
          nodeCoords.set(tx.to_address, { x, y });
          branchNodesList.push(tx.to_address);

          const idx = branchNodesList.length;
          let sublabel = 'TRANSIT WALLET';
          if (tx.is_adversarial) {
            sublabel = tx.adversarial_tag?.includes('DUST')
              ? 'DUSTING VICTIM'
              : 'POISONING TRAP';
          }

          layoutNodes.push({
            id: tx.to_address,
            x,
            y,
            type: 'branch',
            label: `1merch...ut0${idx}`,
            sublabel,
            isAdversarial: tx.is_adversarial,
            adversarialTag: tx.adversarial_tag,
          });
        }
      }
    });

    // Build Edges
    trace.transactions.forEach((tx) => {
      const fromCoord = nodeCoords.get(tx.from_address);
      const toCoord = nodeCoords.get(tx.to_address);

      if (fromCoord && toCoord) {
        const isTrunk = trunkSet.has(tx.from_address) && trunkSet.has(tx.to_address);

        let pathD = '';
        let midX = 0;
        let midY = 0;

        if (isTrunk) {
          // Straight horizontal line with arrow
          const startX = fromCoord.x + 24;
          const endX = toCoord.x - 24;
          pathD = `M ${startX} ${trunkY} L ${endX} ${trunkY}`;
          midX = (startX + endX) / 2;
          midY = trunkY;
        } else {
          // Smooth Bezier curve upward to branch
          const startX = fromCoord.x + 12;
          const startY = fromCoord.y - 18;
          const endX = toCoord.x - 18;
          const endY = toCoord.y + 18;

          const cp1x = startX + 40;
          const cp1y = startY - 70;
          const cp2x = endX - 50;
          const cp2y = endY + 60;

          pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
          midX = (startX + endX) / 2 - 15;
          midY = (startY + endY) / 2 - 15;
        }

        layoutEdges.push({
          txHash: tx.tx_hash,
          from: tx.from_address,
          to: tx.to_address,
          fromX: fromCoord.x,
          fromY: fromCoord.y,
          toX: toCoord.x,
          toY: toCoord.y,
          amount: tx.amount,
          currency: tx.currency,
          isTrunk,
          isAdversarial: tx.is_adversarial,
          adversarialTag: tx.adversarial_tag,
          midX,
          midY,
          pathD,
        });
      }
    });

    return {
      nodes: layoutNodes,
      edges: layoutEdges,
      svgWidth: width,
      svgHeight: height,
    };
  }, [trace]);

  return (
    <div className="bg-[#080d1a] border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col space-y-4">
      {/* Top Banner Subheading */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-slate-300 font-semibold tracking-wide uppercase text-[11px]">
            Active Connection Flow Trail
          </span>
          <span className="text-slate-500 font-mono">
            ({trace.currency} Multi-Hop Peel Chain)
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Click any wallet node or transfer badge to inspect
        </span>
      </div>

      {/* Main Flow Diagram Area */}
      <div className="w-full overflow-x-auto pb-4 pt-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[900px] select-none"
          style={{ minHeight: '340px' }}
        >
          <defs>
            {/* Arrowhead marker for trunk arrows */}
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
            </marker>

            {/* Cyan glow filter */}
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.4" />
            </filter>

            {/* Red glow filter */}
            <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ef4444" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* 1. RENDER EDGES & CURVED BRANCHES */}
          {edges.map((edge) => {
            const isSelected = selectedEntity?.data?.txHash === edge.txHash;
            return (
              <g
                key={edge.txHash}
                className="cursor-pointer group"
                onClick={() => setSelectedEntity({ type: 'edge', data: edge })}
              >
                {/* Edge path line */}
                <path
                  d={edge.pathD}
                  fill="none"
                  stroke={edge.isAdversarial ? '#f43f5e' : '#38bdf8'}
                  strokeWidth={edge.isTrunk ? 3 : 2}
                  strokeDasharray={edge.isAdversarial ? '5,5' : 'none'}
                  markerEnd={edge.isTrunk ? 'url(#arrow-cyan)' : undefined}
                  className="transition-all duration-300 opacity-80 group-hover:opacity-100 group-hover:stroke-white"
                  filter="url(#glow-cyan)"
                />

                {/* Amount Pill Badge on the Path */}
                <g transform={`translate(${edge.midX}, ${edge.midY})`}>
                  <rect
                    x="-42"
                    y="-12"
                    width="84"
                    height="22"
                    rx="11"
                    fill={isSelected ? '#0284c7' : '#0c1527'}
                    stroke={isSelected ? '#38bdf8' : '#1e293b'}
                    strokeWidth="1.5"
                    className="transition-colors group-hover:fill-sky-950 group-hover:stroke-sky-400"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {formatCrypto(edge.amount, edge.currency)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 2. RENDER NODES */}
          {nodes.map((node) => {
            const isSelected = selectedEntity?.data?.id === node.id;

            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                onClick={() => setSelectedEntity({ type: 'node', data: node })}
              >
                {/* SOURCE NODE (Left Red Circle) */}
                {node.type === 'source' && (
                  <g transform={`translate(${node.x}, ${node.y})`}>
                    {/* Pulsing Outer Ring */}
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
                      filter="url(#glow-red)"
                      className="group-hover:scale-105 transition-transform"
                    />
                    {/* Skull icon inside */}
                    <g transform="translate(-10, -10)">
                      <Skull className="w-5 h-5 text-rose-400" />
                    </g>

                    {/* Labels underneath */}
                    <text
                      y="40"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {node.label}
                    </text>
                    <text
                      y="54"
                      textAnchor="middle"
                      fill="#f43f5e"
                      fontSize="9"
                      fontWeight="800"
                      letterSpacing="1"
                    >
                      {node.sublabel}
                    </text>
                  </g>
                )}

                {/* TRUNK TRANSIT NODES (Bottom Horizontal Spine) */}
                {node.type === 'trunk' && (
                  <g transform={`translate(${node.x}, ${node.y})`}>
                    <circle
                      r="20"
                      fill="#080e1e"
                      stroke={isSelected ? '#38bdf8' : '#1e3a5f'}
                      strokeWidth="2"
                      className="group-hover:stroke-sky-400 group-hover:scale-105 transition-all"
                    />
                    <g transform="translate(-8, -8)">
                      <Info className="w-4 h-4 text-sky-400" />
                    </g>

                    {/* Labels underneath */}
                    <text
                      y="38"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {node.label}
                    </text>
                    <text
                      y="52"
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      fontWeight="700"
                      letterSpacing="0.8"
                    >
                      {node.sublabel}
                    </text>
                  </g>
                )}

                {/* BRANCH NODES (Upward Curving Peels) */}
                {node.type === 'branch' && (
                  <g transform={`translate(${node.x}, ${node.y})`}>
                    <circle
                      r="20"
                      fill="#080e1e"
                      stroke={
                        node.isAdversarial
                          ? '#f43f5e'
                          : isSelected
                          ? '#38bdf8'
                          : '#1e3a5f'
                      }
                      strokeWidth="2"
                      className="group-hover:stroke-sky-400 group-hover:scale-105 transition-all"
                    />
                    <g transform="translate(-8, -8)">
                      {node.isAdversarial ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Info className="w-4 h-4 text-sky-400" />
                      )}
                    </g>

                    {/* Labels underneath */}
                    <text
                      y="36"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {node.label}
                    </text>
                    <text
                      y="50"
                      textAnchor="middle"
                      fill={node.isAdversarial ? '#f43f5e' : '#64748b'}
                      fontSize="9"
                      fontWeight="700"
                      letterSpacing="0.8"
                    >
                      {node.sublabel}
                    </text>
                  </g>
                )}

                {/* SINK CASHOUT NODE (Right Bank / Exchange) */}
                {node.type === 'sink' && (
                  <g transform={`translate(${node.x}, ${node.y})`}>
                    <circle
                      r="24"
                      fill="#091b29"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      filter="url(#glow-cyan)"
                      className="group-hover:scale-105 transition-all"
                    />
                    <g transform="translate(-10, -10)">
                      <Building2 className="w-5 h-5 text-sky-300" />
                    </g>

                    {/* Labels underneath */}
                    <text
                      y="40"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {node.label}
                    </text>
                    <text
                      y="54"
                      textAnchor="middle"
                      fill="#10b981"
                      fontSize="9"
                      fontWeight="800"
                      letterSpacing="1"
                    >
                      {node.sublabel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Entity Drawer / Bottom Inspector */}
      {selectedEntity && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-sky-950 text-sky-400 border border-sky-800">
                {selectedEntity.type === 'node' ? 'WALLET NODE' : 'TRANSACTION TRANSFER'}
              </span>
              <span className="font-mono text-white font-bold select-all">
                {selectedEntity.type === 'node'
                  ? selectedEntity.data.id
                  : selectedEntity.data.txHash}
              </span>
            </div>

            <p className="text-slate-400 text-[11px] font-mono">
              {selectedEntity.type === 'node'
                ? `Role: ${selectedEntity.data.sublabel} • Total Balance Out: ${formatCrypto(selectedEntity.data.totalSent || 0, currency)}`
                : `Transferred: ${formatCrypto(selectedEntity.data.amount, selectedEntity.data.currency)} from ${shortenAddr(selectedEntity.data.from)} → ${shortenAddr(selectedEntity.data.to)}`}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={(e) =>
                handleCopy(
                  selectedEntity.type === 'node'
                    ? selectedEntity.data.id
                    : selectedEntity.data.txHash,
                  e
                )
              }
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
