import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Info } from 'lucide-react';

interface PyVisGraphViewerProps {
  serverUrl: string;
  targetAddress: string;
}

export const PyVisGraphViewer: React.FC<PyVisGraphViewerProps> = ({ serverUrl, targetAddress }) => {
  const [key, setKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const graphUrl = `${serverUrl}/api/v1/graph/html?address=${encodeURIComponent(targetAddress)}&t=${key}`;

  return (
    <div className={`bg-[#070b14] border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4 animate-fadeIn ${
      isFullscreen ? 'fixed inset-4 z-50 overflow-hidden flex flex-col' : ''
    }`}>
      {/* Header Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-slate-300 font-bold tracking-wide uppercase text-[11px]">
            PyVis 2D Physics Graph
          </span>
          <span className="text-slate-500 font-mono hidden sm:inline">
            ForceAtlas2 Directed Simulation
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setKey((k) => k + 1)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-mono text-xs"
            title="Reload simulation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <a
            href={graphUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition font-mono text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>New Tab</span>
          </a>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Physics Graph Frame */}
      <div className={`w-full rounded-xl overflow-hidden border border-slate-800 bg-[#0a0f1d] ${
        isFullscreen ? 'flex-1 h-full' : 'h-[540px]'
      }`}>
        <iframe
          key={key}
          src={graphUrl}
          title="PyVis Forensic Graph"
          className="w-full h-full border-0"
          loading="lazy"
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Nodes can be dragged, zoomed, and pinned. Hover any edge to inspect flow amount & adversarial warnings.</span>
        </div>
      </div>
    </div>
  );
};
