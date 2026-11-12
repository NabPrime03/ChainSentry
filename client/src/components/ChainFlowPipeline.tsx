import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Skull,
  Info,
  Check,
  Copy,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Flame,
  ArrowRight,
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
    isMixer: boolean;
    isCashout: boolean;
    stoppingReason?: string;
    entityName?: string;
    x: number;
    y: number;
    balance?: number;
    totalSent?: number;
    totalReceived?: number;
    inDegree?: number;
    outDegree?: number;
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
    isSink: boolean;
    isCashout: boolean;
    stoppingReason?: string;
    entityName?: string;
    x: number;
    y: number;
    amount: number;
    currency: string;
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
    stoppingReason?: string;
    entityName?: string;
    details?: string;
    inDegree?: number;
    outDegree?: number;
    balance?: number;
    isAdversarial?: boolean;
    adversarialTag?: string;
  } | null>(null);

  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Flow Stepping / Playback State
  const [activeHopIndex, setActiveHopIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Build the clean pipeline using REAL server data and entities
  const { hops, totalWidth, totalHeight } = useMemo(() => {
    const sourceAddr = trace.target_address;

    // Create lookup for end receivers
    const endReceiversMap = new Map<string, typeof trace.end_receivers[0]>();
    for (const r of trace.end_receivers) {
      endReceiversMap.set(r.address, r);
    }

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

    // Layout constants
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
      const receiverInfo = endReceiversMap.get(currentAddr);

      const isCashout = Boolean(receiverInfo?.is_terminal_cashout || receiverInfo?.entity_type === 'EXCHANGE');
      const isMixer = Boolean(receiverInfo?.is_mixer || receiverInfo?.entity_type === 'MIXER');

      // REAL label & sublabel from server data (NO fake dummy entries)
      let trunkLabel = shortenAddr(currentAddr, 6);
      let trunkSublabel = `TRANSIT HOP ${i}`;

      if (isSource) {
        if (currentAddr.toLowerCase().includes('hacker') || currentAddr.toLowerCase().includes('vault')) {
          trunkLabel = 'Hacker Vault';
        } else {
          trunkLabel = shortenAddr(currentAddr, 6);
        }
        trunkSublabel = 'ILLICIT SOURCE';
      } else if (isSink) {
        if (receiverInfo?.entity_name) {
          trunkLabel = receiverInfo.entity_name;
        } else if (currentAddr.toLowerCase().includes('binance')) {
          trunkLabel = 'Binance Cashout';
        } else if (isMixer) {
          trunkLabel = 'Mixer Pool';
        } else {
          trunkLabel = shortenAddr(currentAddr, 6);
        }

        if (isCashout) {
          trunkSublabel = 'EXCHANGE RAMP';
        } else if (isMixer) {
          trunkSublabel = 'MIXER / TUMBLER';
        } else {
          trunkSublabel = 'COLD STORAGE SINK';
        }
      } else {
        trunkLabel = shortenAddr(currentAddr, 6);
        trunkSublabel = `TRANSIT HOP ${i}`;
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
        const peelReceiver = endReceiversMap.get(topPeel.to_address);

        // Positioned between trunk nodes for clean curved geometry
        const peelX = trunkX + 110;
        const peelY = branchY;

        let pLabel = shortenAddr(topPeel.to_address, 6);
        if (peelReceiver?.entity_name) {
          pLabel = peelReceiver.entity_name;
        }

        let pSublabel = 'TRANSIT WALLET';
        if (topPeel.is_adversarial) {
          pSublabel = topPeel.adversarial_tag?.includes('DUST')
            ? 'DUSTING TRAP'
            : 'POISONING TRAP';
        } else if (peelReceiver?.is_terminal_cashout) {
          pSublabel = 'EXCHANGE RAMP';
        } else if (peelReceiver?.is_mixer) {
          pSublabel = 'MIXER SINK';
        } else if (peelReceiver?.stopping_reason?.includes('Cold Storage')) {
          pSublabel = 'COLD SINK';
        }

        peelNode = {
          address: topPeel.to_address,
          label: pLabel,
          sublabel: pSublabel,
          isAdversarial: Boolean(topPeel.is_adversarial),
          adversarialTag: topPeel.adversarial_tag,
          isSink: Boolean(peelReceiver?.is_sink),
          isCashout: Boolean(peelReceiver?.is_terminal_cashout),
          stoppingReason: peelReceiver?.stopping_reason,
          entityName: peelReceiver?.entity_name ?? undefined,
          x: peelX,
          y: peelY,
          amount: topPeel.amount,
          currency: topPeel.currency,
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
          isMixer,
          isCashout,
          stoppingReason: receiverInfo?.stopping_reason,
          entityName: receiverInfo?.entity_name ?? undefined,
          x: trunkX,
          y: trunkY,
          balance: nodeInfo?.balance_estimate,
          totalSent: nodeInfo?.total_sent,
          totalReceived: nodeInfo?.total_received,
          inDegree: nodeInfo?.in_degree,
          outDegree: nodeInfo?.out_degree,
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

  // Stepping timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveHopIndex((curr) => {
          if (curr === null || curr >= hops.length - 1) {
            return 0;
          }
          return curr + 1;
        });
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, hops.length]);

  return (
    <div className="bg-[#070b14] border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col space-y-4">
      {/* Visual Header with Playback Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-slate-200 font-bold tracking-wide uppercase text-[11px]">
            Connection Flow Pipeline
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            ({hops.length} Hops • {trace.total_edges} Transfers)
          </span>
        </div>

        {/* Stepping / Playback Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Step Back */}
          <button
            onClick={() => {
              setIsPlaying(false);
              setActiveHopIndex((curr) => (curr === null || curr <= 0 ? 0 : curr - 1));
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Previous Hop"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={() => {
              if (activeHopIndex === null) setActiveHopIndex(0);
              setIsPlaying(!isPlaying);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
              isPlaying
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-sky-400'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Play Flow</span>
              </>
            )}
          </button>

          {/* Step Forward */}
          <button
            onClick={() => {
              setIsPlaying(false);
              setActiveHopIndex((curr) =>
                curr === null || curr >= hops.length - 1 ? hops.length - 1 : curr + 1
              );
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Next Hop"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Reset */}
          <button
            onClick={() => {
              setIsPlaying(false);
              setActiveHopIndex(null);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Reset Playthrough"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Hop Indicator Pill */}
          {activeHopIndex !== null && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-bold ml-1">
              HOP {activeHopIndex + 1}/{hops.length}
            </span>
          )}
        </div>
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
            const { trunkNode, trunkEdge, peelNode, peelEdge, hopIndex } = hop;
            const isHopActive = activeHopIndex === hopIndex;

            return (
              <g key={trunkNode.address} className={activeHopIndex !== null && !isHopActive ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
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
                        isAdversarial: peelEdge.isAdversarial,
                        adversarialTag: peelNode?.adversarialTag ?? undefined,
                        stoppingReason: peelNode?.stoppingReason,
                        entityName: peelNode?.entityName,
                        details: `Peeled off ${formatCrypto(peelEdge.amount, peelEdge.currency)} from ${shortenAddr(peelEdge.from)} → ${shortenAddr(peelEdge.to)}`,
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
                        x="-44"
                        y="-12"
                        width="88"
                        height="24"
                        rx="12"
                        fill="#0b1324"
                        stroke={peelEdge.isAdversarial ? '#f43f5e' : '#00d2ff'}
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
                        amount: peelNode.amount,
                        currency: peelNode.currency,
                        isAdversarial: peelNode.isAdversarial,
                        adversarialTag: peelNode.adversarialTag ?? undefined,
                        stoppingReason: peelNode.stoppingReason,
                        entityName: peelNode.entityName,
                        details: peelNode.isAdversarial
                          ? `⚠️ Flagged by Security Engine: ${peelNode.adversarialTag || 'Adversarial Trap'}`
                          : peelNode.stoppingReason || 'Secondary Peel Transit Destination',
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

                {/* 3. TRUNK HORIZONTAL ARROW */}
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
                      stroke={isHopActive ? '#38bdf8' : '#00d2ff'}
                      strokeWidth={isHopActive ? '5' : '3.5'}
                      strokeLinecap="round"
                      style={{
                        filter: isHopActive
                          ? 'drop-shadow(0px 0px 10px rgba(56, 189, 248, 1))'
                          : 'drop-shadow(0px 0px 6px rgba(0, 210, 255, 0.8))',
                      }}
                      className="transition-all group-hover:stroke-white"
                    />

                    {/* Prominent Arrowhead Pointing Right into the next node */}
                    <polygon
                      points={`${trunkEdge.endX},${trunkEdge.y} ${trunkEdge.endX - 10},${trunkEdge.y - 6} ${trunkEdge.endX - 10},${trunkEdge.y + 6}`}
                      fill={isHopActive ? '#38bdf8' : '#00d2ff'}
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
                        fill={isHopActive ? '#0284c7' : '#0b1324'}
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
                      stoppingReason: trunkNode.stoppingReason,
                      entityName: trunkNode.entityName,
                      inDegree: trunkNode.inDegree,
                      outDegree: trunkNode.outDegree,
                      balance: trunkNode.balance,
                      details: trunkNode.stoppingReason || `Total Outflow: ${formatCrypto(trunkNode.totalSent || 0, currency)}`,
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
                        opacity={isHopActive ? '0.8' : '0.3'}
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

                  {/* SINK CASHOUT NODE / MIXER (Right Terminal Node) */}
                  {trunkNode.isSink && !trunkNode.isSource && (
                    <>
                      <circle
                        r="24"
                        fill="#091b29"
                        stroke={trunkNode.isMixer ? '#a855f7' : '#00d2ff'}
                        strokeWidth="2.5"
                        style={{
                          filter: trunkNode.isMixer
                            ? 'drop-shadow(0px 0px 8px rgba(168, 85, 247, 0.8))'
                            : 'drop-shadow(0px 0px 8px rgba(0, 210, 255, 0.8))',
                        }}
                        className="group-hover:scale-105 transition-all"
                      />
                      <g transform="translate(-10, -10)">
                        {trunkNode.isMixer ? (
                          <Flame className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Building2 className="w-5 h-5 text-sky-300" />
                        )}
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
                        fill={trunkNode.isMixer ? '#c084fc' : '#10b981'}
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
                        stroke={isHopActive ? '#38bdf8' : '#00d2ff'}
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

      {/* Enhanced Forensic Inspector (When clicking any node or amount badge) */}
      {selectedEntity && (
        <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs animate-fadeIn">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-sky-950 text-sky-400 border border-sky-800">
                {selectedEntity.subtitle}
              </span>
              {selectedEntity.entityName && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {selectedEntity.entityName}
                </span>
              )}
              {selectedEntity.isAdversarial && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  {selectedEntity.adversarialTag || 'Adversarial Decoy'}
                </span>
              )}
              <span className="font-mono text-white font-bold select-all">
                {selectedEntity.addressOrHash}
              </span>
            </div>

            {/* Forensic Stopping Reason from Server */}
            {selectedEntity.stoppingReason && (
              <div className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-2 text-amber-300 text-[11px] font-mono">
                <span className="font-bold block text-amber-400 text-[10px] uppercase">Forensic Stopping Decision:</span>
                {selectedEntity.stoppingReason}
              </div>
            )}

            <p className="text-slate-300 text-[11px] font-mono">
              {selectedEntity.details}
            </p>

            {/* Degree & Balance Stats if Available */}
            {(selectedEntity.inDegree !== undefined || selectedEntity.balance !== undefined) && (
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono pt-1">
                {selectedEntity.inDegree !== undefined && (
                  <span>In-Degree: <b className="text-slate-200">{selectedEntity.inDegree}</b></span>
                )}
                {selectedEntity.outDegree !== undefined && (
                  <span>Out-Degree: <b className="text-slate-200">{selectedEntity.outDegree}</b></span>
                )}
                {selectedEntity.balance !== undefined && (
                  <span>Balance: <b className="text-emerald-400">{formatCrypto(selectedEntity.balance, currency)}</b></span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
