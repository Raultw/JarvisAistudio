import React, { useEffect, useRef, useState } from 'react';
import { DisplayMood } from '../types';
import { Eye, RefreshCw, Sparkles, Monitor, Maximize2 } from 'lucide-react';

interface St7735DisplayProps {
  mood: DisplayMood;
  message: string;
  onMoodChange?: (mood: DisplayMood, message?: string) => void;
  compact?: boolean;
}

export const St7735Display: React.FC<St7735DisplayProps> = ({
  mood,
  message,
  onMoodChange,
  compact = false
}) => {
  const [blink, setBlink] = useState(false);
  const [lookOffset, setLookOffset] = useState({ x: 0, y: 0 });
  const [scanlines, setScanlines] = useState(true);
  const [pixelGrid, setPixelGrid] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // Periodic blinking and autonomous eye movement
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 180);
    }, 4000 + Math.random() * 3000);

    const lookInterval = setInterval(() => {
      if (mood === 'THINKING') {
        setLookOffset({
          x: (Math.random() - 0.5) * 8,
          y: -4 + (Math.random() - 0.5) * 4
        });
      } else if (mood === 'ALERT') {
        setLookOffset({
          x: (Math.random() - 0.5) * 6,
          y: (Math.random() - 0.5) * 6
        });
      } else {
        setLookOffset({
          x: (Math.random() - 0.5) * 4,
          y: (Math.random() - 0.5) * 3
        });
      }
    }, 2400);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(lookInterval);
    };
  }, [mood]);

  // Color theme based on mood
  const getThemeColors = () => {
    switch (mood) {
      case 'ALERT':
        return {
          glow: 'rgba(239, 68, 68, 0.9)',
          eyeFill: '#ef4444',
          eyeBorder: '#f87171',
          bg: '#0a0202',
          text: '#fca5a5'
        };
      case 'HAPPY':
        return {
          glow: 'rgba(34, 197, 94, 0.85)',
          eyeFill: '#22c55e',
          eyeBorder: '#86efac',
          bg: '#020d06',
          text: '#86efac'
        };
      case 'THINKING':
        return {
          glow: 'rgba(168, 85, 247, 0.85)',
          eyeFill: '#a855f7',
          eyeBorder: '#d8b4fe',
          bg: '#08020e',
          text: '#e9d5ff'
        };
      case 'SARCASTIC':
        return {
          glow: 'rgba(245, 158, 11, 0.85)',
          eyeFill: '#f59e0b',
          eyeBorder: '#fcd34d',
          bg: '#0c0801',
          text: '#fde68a'
        };
      case 'SLEEPING':
        return {
          glow: 'rgba(56, 189, 248, 0.4)',
          eyeFill: '#38bdf8',
          eyeBorder: '#7dd3fc',
          bg: '#01080e',
          text: '#7dd3fc'
        };
      case 'NEUTRAL':
      default:
        return {
          glow: 'rgba(6, 182, 212, 0.9)',
          eyeFill: '#06b6d4',
          eyeBorder: '#67e8f9',
          bg: '#02090f',
          text: '#a5f3fc'
        };
    }
  };

  const theme = getThemeColors();

  // Parse 2 lines of message
  const lines = (message || '').split('\n').slice(0, 2);
  while (lines.length < 2) lines.push('');

  // Dimensions of physical ST7735 0.96": 80x160 pixels
  // In landscape: 160x80 pixels
  const screenWidth = isLandscape ? 160 : 80;
  const screenHeight = isLandscape ? 80 : 160;

  // Scale factor for display
  const scale = compact ? 2 : 2.75;
  const displayW = screenWidth * scale;
  const displayH = screenHeight * scale;

  return (
    <div id="st7735-tft-module" className="flex flex-col items-center">
      {/* Physical Hardware Frame */}
      <div className="relative p-4 rounded-2xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border border-slate-700 shadow-2xl shadow-cyan-950/40">
        {/* Hardware PCB Branding */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60 text-[10px] tracking-wider font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-slate-200">ST7735 0.96" IPS</span>
            <span className="text-slate-500">80x160 RGB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400/80 font-bold">SPI BUS</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[9px] text-slate-300">3.3V</span>
          </div>
        </div>

        {/* Display Glass Bezel */}
        <div
          className="relative overflow-hidden rounded-md border-2 border-slate-950 shadow-inner"
          style={{
            width: `${displayW}px`,
            height: `${displayH}px`,
            backgroundColor: theme.bg
          }}
        >
          {/* Subtle IPS Screen Glare */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent z-20" />

          {/* Scanlines Effect */}
          {scanlines && (
            <div
              className="absolute inset-0 pointer-events-none z-10 opacity-30"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.8) 2px, rgba(0,0,0,0.8) 4px)'
              }}
            />
          )}

          {/* Pixel Grid Texture */}
          {pixelGrid && (
            <div
              className="absolute inset-0 pointer-events-none z-10 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                backgroundSize: '4px 4px'
              }}
            />
          )}

          {/* Vector Eyes & Face Graphics (SVG Canvas) */}
          <svg
            viewBox={`0 0 ${screenWidth} ${screenHeight}`}
            className="w-full h-full"
            style={{ shapeRendering: 'crispEdges' }}
          >
            <defs>
              <filter id="eyeGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background ambient glow */}
            <rect width={screenWidth} height={screenHeight} fill={theme.bg} />

            {/* Render Face based on mood */}
            <g
              transform={`translate(${screenWidth / 2}, ${isLandscape ? 34 : 58})`}
              filter="url(#eyeGlow)"
            >
              {/* === NEUTRAL === */}
              {mood === 'NEUTRAL' && (
                <g>
                  {/* Left Eye */}
                  <rect
                    x={-24 + lookOffset.x}
                    y={blink ? 3 : -14 + lookOffset.y}
                    width="18"
                    height={blink ? 2 : 28}
                    rx={blink ? 1 : 5}
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.2"
                  />
                  {/* Right Eye */}
                  <rect
                    x={6 + lookOffset.x}
                    y={blink ? 3 : -14 + lookOffset.y}
                    width="18"
                    height={blink ? 2 : 28}
                    rx={blink ? 1 : 5}
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.2"
                  />
                  {/* Pupil Accents */}
                  {!blink && (
                    <>
                      <circle cx={-15 + lookOffset.x} cy={0 + lookOffset.y} r="2.5" fill="#ffffff" />
                      <circle cx={15 + lookOffset.x} cy={0 + lookOffset.y} r="2.5" fill="#ffffff" />
                    </>
                  )}
                </g>
              )}

              {/* === THINKING === */}
              {mood === 'THINKING' && (
                <g>
                  {/* Left Eye (Squinting/Narrowed) */}
                  <rect
                    x="-24"
                    y={blink ? 2 : -8}
                    width="18"
                    height={blink ? 2 : 16}
                    rx="3"
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.2"
                  />
                  {/* Right Eye (Raised & Scanning arc) */}
                  <rect
                    x="6"
                    y={blink ? 2 : -20 + lookOffset.y}
                    width="18"
                    height={blink ? 2 : 28}
                    rx="4"
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.2"
                  />
                  {/* Pulsing processing dots */}
                  <circle cx={-15} cy={16} r="1.5" fill={theme.eyeBorder} opacity="0.8" />
                  <circle cx={0} cy={16} r="2" fill={theme.eyeBorder} />
                  <circle cx={15} cy={16} r="1.5" fill={theme.eyeBorder} opacity="0.8" />
                </g>
              )}

              {/* === HAPPY === */}
              {mood === 'HAPPY' && (
                <g>
                  {/* Left Happy Arc */}
                  <path
                    d={`M -25,${blink ? 4 : 4} Q -15,${blink ? 6 : -18} -5,${blink ? 4 : 4}`}
                    fill="none"
                    stroke={theme.eyeFill}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* Right Happy Arc */}
                  <path
                    d={`M 5,${blink ? 4 : 4} Q 15,${blink ? 6 : -18} 25,${blink ? 4 : 4}`}
                    fill="none"
                    stroke={theme.eyeFill}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* Subtle cheeks */}
                  <circle cx="-20" cy="12" r="3" fill={theme.glow} opacity="0.5" />
                  <circle cx="20" cy="12" r="3" fill={theme.glow} opacity="0.5" />
                </g>
              )}

              {/* === ALERT === */}
              {mood === 'ALERT' && (
                <g>
                  {/* Wide Alert Left Eye */}
                  <circle
                    cx={-15 + lookOffset.x}
                    cy={0 + lookOffset.y}
                    r={blink ? 2 : 14}
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.5"
                  />
                  {/* Wide Alert Right Eye */}
                  <circle
                    cx={15 + lookOffset.x}
                    cy={0 + lookOffset.y}
                    r={blink ? 2 : 14}
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.5"
                  />
                  {/* Danger Exclamation Core */}
                  {!blink && (
                    <>
                      <rect x={-16 + lookOffset.x} y={-7 + lookOffset.y} width="2" height="8" fill="#ffffff" />
                      <circle cx={-15 + lookOffset.x} cy={5 + lookOffset.y} r="1.2" fill="#ffffff" />
                      <rect x={14 + lookOffset.x} y={-7 + lookOffset.y} width="2" height="8" fill="#ffffff" />
                      <circle cx={15 + lookOffset.x} cy={5 + lookOffset.y} r="1.2" fill="#ffffff" />
                    </>
                  )}
                </g>
              )}

              {/* === SLEEPING === */}
              {mood === 'SLEEPING' && (
                <g opacity="0.75">
                  {/* Slit Left Eye */}
                  <line x1="-24" y1="0" x2="-6" y2="0" stroke={theme.eyeFill} strokeWidth="3" strokeLinecap="round" />
                  {/* Slit Right Eye */}
                  <line x1="6" y1="0" x2="24" y2="0" stroke={theme.eyeFill} strokeWidth="3" strokeLinecap="round" />
                  {/* Animated ZZZ text */}
                  <text x="12" y="-12" fill={theme.text} fontSize="7" fontFamily="monospace" fontWeight="bold">z</text>
                  <text x="18" y="-18" fill={theme.text} fontSize="9" fontFamily="monospace" fontWeight="bold">Z</text>
                </g>
              )}

              {/* === SARCASTIC === */}
              {mood === 'SARCASTIC' && (
                <g>
                  {/* Left Eye: normal but half-lidded */}
                  <rect
                    x="-24"
                    y={blink ? 3 : -12}
                    width="18"
                    height={blink ? 2 : 24}
                    rx="3"
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.2"
                  />
                  {/* Cocked Eyebrow over left eye */}
                  <line x1="-26" y1="-18" x2="-6" y2="-13" stroke={theme.eyeBorder} strokeWidth="2.5" strokeLinecap="round" />

                  {/* Right Eye: very narrow squint */}
                  <rect
                    x="6"
                    y={blink ? 3 : -3}
                    width="18"
                    height={blink ? 2 : 8}
                    rx="2"
                    fill={theme.eyeFill}
                    stroke={theme.eyeBorder}
                    strokeWidth="1.2"
                  />
                  {/* Flat skeptical eyebrow over right eye */}
                  <line x1="4" y1="-7" x2="26" y2="-7" stroke={theme.eyeBorder} strokeWidth="2" strokeLinecap="round" />

                  {/* Subtle smirk */}
                  <path d="M -6,14 Q 4,18 12,12" fill="none" stroke={theme.eyeBorder} strokeWidth="1.8" strokeLinecap="round" />
                </g>
              )}
            </g>

            {/* Divider Line on Display */}
            <line
              x1="6"
              y1={isLandscape ? 60 : 110}
              x2={screenWidth - 6}
              y2={isLandscape ? 60 : 110}
              stroke={theme.eyeFill}
              strokeWidth="0.8"
              opacity="0.4"
            />

            {/* 2-Line Text Message Area (ST7735 Font Rendering) */}
            <g transform={`translate(${screenWidth / 2}, ${isLandscape ? 68 : 124})`}>
              <text
                x="0"
                y="0"
                textAnchor="middle"
                fill={theme.text}
                fontSize="6"
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="0.4"
              >
                {lines[0] || ' '}
              </text>
              <text
                x="0"
                y="9"
                textAnchor="middle"
                fill={theme.text}
                fontSize="5.5"
                fontFamily="monospace"
                fontWeight="normal"
                opacity="0.85"
                letterSpacing="0.3"
              >
                {lines[1] || ' '}
              </text>
            </g>

            {/* Status Footer Mini Bar (Battery / Wifi icon simulation) */}
            <g transform={`translate(6, ${screenHeight - 8})`} opacity="0.6">
              <text x="0" y="5" fill={theme.text} fontSize="4" fontFamily="monospace">
                SPI:{mood.slice(0, 3)}
              </text>
              <rect x={screenWidth - 18} y="1" width="8" height="4" fill="none" stroke={theme.text} strokeWidth="0.6" rx="0.5" />
              <rect x={screenWidth - 16} y="2" width="4" height="2" fill={theme.text} />
            </g>
          </svg>
        </div>

        {/* Physical Pin Header Pinout Print on PCB (Just like real ST7735 board) */}
        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[8px] font-mono text-slate-400">
          <div className="flex gap-1">
            <span className="bg-red-950/80 text-red-300 px-1 py-0.5 rounded border border-red-800/40">VCC</span>
            <span className="bg-slate-900 text-slate-400 px-1 py-0.5 rounded border border-slate-800">GND</span>
            <span className="bg-cyan-950/80 text-cyan-300 px-1 py-0.5 rounded border border-cyan-800/40">SCK</span>
            <span className="bg-cyan-950/80 text-cyan-300 px-1 py-0.5 rounded border border-cyan-800/40">SDA</span>
          </div>
          <div className="flex gap-1">
            <span className="bg-amber-950/80 text-amber-300 px-1 py-0.5 rounded border border-amber-800/40">RES</span>
            <span className="bg-purple-950/80 text-purple-300 px-1 py-0.5 rounded border border-purple-800/40">DC</span>
            <span className="bg-blue-950/80 text-blue-300 px-1 py-0.5 rounded border border-blue-800/40">CS</span>
            <span className="bg-emerald-950/80 text-emerald-300 px-1 py-0.5 rounded border border-emerald-800/40">BLK</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls Bar for testing moods directly */}
      {onMoodChange && (
        <div className="mt-3 w-full max-w-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>TEST DE EXPRESIÓN TFT</span>
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setScanlines(!scanlines)}
                className={`px-1.5 py-0.5 rounded border ${scanlines ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/30' : 'border-slate-800 text-slate-500'}`}
              >
                Scanline
              </button>
              <button
                type="button"
                onClick={() => setIsLandscape(!isLandscape)}
                className={`px-1.5 py-0.5 rounded border ${isLandscape ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/30' : 'border-slate-800 text-slate-500'}`}
              >
                {isLandscape ? '160x80' : '80x160'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
            {(['NEUTRAL', 'THINKING', 'HAPPY', 'ALERT', 'SLEEPING', 'SARCASTIC'] as DisplayMood[]).map(m => {
              const isActive = mood === m;
              return (
                <button
                  key={m}
                  type="button"
                  id={`btn-mood-${m.toLowerCase()}`}
                  onClick={() => onMoodChange(m, `MODO ${m}\nESP32-S3 SINC`)}
                  className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold shadow-sm shadow-cyan-500/20'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
