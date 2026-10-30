import React, { useMemo } from 'react';
import { OrbState } from '../types';
import { Mic, Volume2, Sparkles, Square, Loader2, AlertCircle } from 'lucide-react';

interface OrbProps {
  state: OrbState;
  amplitude?: number; // 0 to 1
  reducedMotion?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  isLiveCall?: boolean;
}

export const Orb: React.FC<OrbProps> = ({
  state,
  amplitude = 0,
  reducedMotion = false,
  onClick,
  size = 'lg',
  isLiveCall = false,
}) => {
  const dimensionClass = {
    sm: 'w-24 h-24',
    md: 'w-44 h-44',
    lg: 'w-56 h-56 sm:w-68 sm:h-68 md:w-76 md:h-76',
  }[size];

  // Visual cues based on current state
  const stateConfig = useMemo(() => {
    switch (state) {
      case 'connecting':
        return {
          glowColor: 'rgba(234, 179, 8, 0.55)',
          innerCore: 'radial-gradient(circle, #fde047 0%, #ca8a04 45%, #854d0e 80%, #422006 100%)',
          ringColor: 'stroke-amber-400',
          pulseScale: 1.04,
          badgeText: 'Connecting...',
          badgeIcon: Loader2,
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
        };
      case 'error':
        return {
          glowColor: 'rgba(239, 68, 68, 0.55)',
          innerCore: 'radial-gradient(circle, #fca5a5 0%, #dc2626 45%, #991b1b 80%, #450a0a 100%)',
          ringColor: 'stroke-red-400',
          pulseScale: 1,
          badgeText: 'Connection Error',
          badgeIcon: AlertCircle,
          badgeBg: 'bg-red-500/20 text-red-300 border-red-400/40',
        };
      case 'listening':
        return {
          glowColor: 'rgba(6, 182, 212, 0.65)',
          innerCore: 'radial-gradient(circle, #22d3ee 0%, #0891b2 45%, #0e7490 80%, #082f49 100%)',
          ringColor: 'stroke-cyan-400',
          pulseScale: 1 + Math.min(amplitude * 0.18, 0.18),
          badgeText: isLiveCall ? 'Live Call • Listening...' : 'Listening...',
          badgeIcon: Mic,
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
        };
      case 'thinking':
        return {
          glowColor: 'rgba(168, 85, 247, 0.65)',
          innerCore: 'radial-gradient(circle, #c084fc 0%, #9333ea 45%, #6b21a8 80%, #3b0764 100%)',
          ringColor: 'stroke-purple-400',
          pulseScale: 1.05,
          badgeText: 'Thinking...',
          badgeIcon: Sparkles,
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
        };
      case 'speaking':
        return {
          glowColor: 'rgba(56, 189, 248, 0.75)',
          innerCore: 'radial-gradient(circle, #38bdf8 0%, #2563eb 45%, #4f46e5 80%, #1e1b4b 100%)',
          ringColor: 'stroke-sky-400',
          pulseScale: 1 + amplitude * 0.25,
          badgeText: isLiveCall ? 'Live Call • Speaking' : 'Speaking',
          badgeIcon: Volume2,
          badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
        };
      case 'stopped':
      case 'idle':
      default:
        return {
          glowColor: 'rgba(14, 165, 233, 0.35)',
          innerCore: 'radial-gradient(circle, #38bdf8 0%, #0284c7 40%, #0369a1 75%, #082f49 100%)',
          ringColor: 'stroke-cyan-500/40',
          pulseScale: 1,
          badgeText: 'Ready',
          badgeIcon: Sparkles,
          badgeBg: 'bg-cyan-950/40 text-cyan-300/80 border-cyan-500/20',
        };
    }
  }, [state, amplitude]);

  const BadgeIcon = stateConfig.badgeIcon;

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-2">
      {/* Outer ambient glow halo */}
      <div
        className={`absolute rounded-full transition-all duration-500 pointer-events-none ${
          reducedMotion ? '' : 'blur-3xl'
        }`}
        style={{
          width: size === 'sm' ? '120px' : '320px',
          height: size === 'sm' ? '120px' : '320px',
          background: stateConfig.glowColor,
          opacity: state === 'idle' ? 0.45 : 0.85,
          transform: `scale(${stateConfig.pulseScale * 1.1})`,
        }}
      />

      {/* Main interactive Orb button */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Tervox AI Orb - Current state: ${state}. Click to interact.`}
        className={`relative ${dimensionClass} group cursor-pointer focus:outline-none transition-transform duration-300 ease-out`}
        style={{
          transform: reducedMotion ? 'none' : `scale(${stateConfig.pulseScale})`,
        }}
      >
        {/* SVG Orbital rings and acoustic waves */}
        <svg
          viewBox="0 0 240 240"
          className="w-full h-full absolute inset-0 overflow-visible"
        >
          {/* Outer dashed compass ring */}
          <circle
            cx="120"
            cy="120"
            r="110"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 8"
            className={`${stateConfig.ringColor} opacity-40 ${
              reducedMotion ? '' : state === 'thinking' ? 'animate-spin-slow' : 'animate-spin-reverse-slow'
            }`}
          />

          {/* Middle segmented tech ring */}
          <circle
            cx="120"
            cy="120"
            r="94"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray={state === 'listening' ? '8 4' : '20 10 5 10'}
            className={`${stateConfig.ringColor} opacity-60 ${
              reducedMotion ? '' : state === 'listening' ? 'animate-spin-slow' : 'animate-spin-slow'
            }`}
          />

          {/* Acoustic wave rings when speaking or listening */}
          {(state === 'speaking' || state === 'listening') && (
            <>
              <circle
                cx="120"
                cy="120"
                r={78 + (amplitude || 0.4) * 16}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={`${stateConfig.ringColor} opacity-70 transition-all duration-75`}
              />
              <circle
                cx="120"
                cy="120"
                r={88 + (amplitude || 0.4) * 22}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className={`${stateConfig.ringColor} opacity-40 transition-all duration-100`}
              />
            </>
          )}

          {/* Thinking particle indicators */}
          {state === 'thinking' && !reducedMotion && (
            <g className="animate-spin-slow origin-center">
              <circle cx="120" cy="22" r="3" fill="#a855f7" className="animate-ping" />
              <circle cx="218" cy="120" r="2.5" fill="#06b6d4" />
              <circle cx="120" cy="218" r="3" fill="#a855f7" />
              <circle cx="22" cy="120" r="2.5" fill="#06b6d4" />
            </g>
          )}

          {/* Core sphere with rich gradient */}
          <circle
            cx="120"
            cy="120"
            r="68"
            fill="url(#coreGradient)"
            className="filter drop-shadow-lg"
          />

          {/* Gradients */}
          <defs>
            <radialGradient id="coreGradient" cx="40%" cy="35%" r="70%">
              <stop
                offset="0%"
                stopColor={
                  state === 'listening'
                    ? '#67e8f9'
                    : state === 'thinking'
                    ? '#e9d5ff'
                    : state === 'speaking'
                    ? '#7dd3fc'
                    : '#bae6fd'
                }
              />
              <stop
                offset="40%"
                stopColor={
                  state === 'listening'
                    ? '#06b6d4'
                    : state === 'thinking'
                    ? '#9333ea'
                    : state === 'speaking'
                    ? '#2563eb'
                    : '#0284c7'
                }
              />
              <stop
                offset="80%"
                stopColor={
                  state === 'listening'
                    ? '#083344'
                    : state === 'thinking'
                    ? '#3b0764'
                    : state === 'speaking'
                    ? '#1e1b4b'
                    : '#082f49'
                }
              />
              <stop offset="100%" stopColor="#030712" />
            </radialGradient>
          </defs>

          {/* Inner specular highlight */}
          <ellipse
            cx="105"
            cy="95"
            rx="24"
            ry="14"
            fill="white"
            opacity="0.32"
            transform="rotate(-25 105 95)"
          />
        </svg>

        {/* Hover interaction overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 border border-cyan-400/40 text-xs text-cyan-200 flex items-center gap-1.5 shadow-lg">
            {state === 'speaking' ? (
              <>
                <Square className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                <span>Stop</span>
              </>
            ) : state === 'listening' ? (
              <>
                <Square className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Stop mic</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tap to talk</span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* State Badge */}
      <div className="mt-3 flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300 ${stateConfig.badgeBg}`}
        >
          <BadgeIcon
            className={`w-3.5 h-3.5 ${
              state === 'listening'
                ? 'animate-pulse text-cyan-300'
                : state === 'thinking'
                ? 'animate-spin text-purple-300'
                : state === 'speaking'
                ? 'animate-bounce text-sky-300'
                : 'text-cyan-400'
            }`}
          />
          <span className="tracking-wide">{stateConfig.badgeText}</span>
        </div>
      </div>
    </div>
  );
};
