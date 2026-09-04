import React, { useState } from 'react';
import { SystemEventLog } from '../types';
import { Activity, Terminal, Shield, Filter, RotateCcw } from 'lucide-react';

interface EventLogViewerProps {
  logs: SystemEventLog[];
  onClearLogs?: () => void;
}

export const EventLogViewer: React.FC<EventLogViewerProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<'ALL' | 'GEMINI_FUNCTION' | 'ESP32_TELEMETRY' | 'USER_ACTION'>('ALL');

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.source === filter;
  });

  const getSourceBadge = (source: SystemEventLog['source']) => {
    switch (source) {
      case 'GEMINI_FUNCTION':
        return <span className="bg-purple-950 text-purple-300 border border-purple-800/40 px-1.5 py-0.2 rounded text-[9px] font-mono">GEMINI TOOL</span>;
      case 'ESP32_TELEMETRY':
        return <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.2 rounded text-[9px] font-mono">ESP32 SPI/HTTP</span>;
      case 'USER_ACTION':
        return <span className="bg-amber-950 text-amber-300 border border-amber-800/40 px-1.5 py-0.2 rounded text-[9px] font-mono">USUARIO</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.2 rounded text-[9px] font-mono">SISTEMA</span>;
    }
  };

  return (
    <div id="system-event-log-panel" className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-200">Registro de Telemetría & Acciones en Vivo</h3>
            <p className="text-[11px] text-slate-400">Stream de eventos entre Node.js, Gemini y ESP32</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {(['ALL', 'GEMINI_FUNCTION', 'ESP32_TELEMETRY', 'USER_ACTION'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                filter === f
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {f === 'ALL' ? 'Todos' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 max-h-72 overflow-y-auto space-y-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Sin eventos registrados para este filtro.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-1"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-2">
                  {getSourceBadge(log.source)}
                  <span className="font-semibold text-slate-200">{log.title}</span>
                </div>
                <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className="text-slate-300 text-[11px] pl-1">{log.details}</div>
              {log.meta && Object.keys(log.meta).length > 0 && (
                <div className="text-[10px] text-slate-500 bg-slate-900/60 p-1 rounded font-mono break-all mt-0.5">
                  {JSON.stringify(log.meta)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
