import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  Cpu,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { gemini } from '../services/gemini';
import { storage } from '../services/storage';

interface ActivationModalProps {
  isOpen: boolean;
  onActivated: (savedMaskedKey: string) => void;
  isSettingsMode?: boolean;
  onClose?: () => void;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({
  isOpen,
  onActivated,
  isSettingsMode = false,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      console.log('[Tervox Modal] Activation modal opened');
      gemini.getServerConfig().then((cfg) => {
        setHasEnvKey(cfg.hasEnvKey);
        console.log('[Tervox Modal] Server config loaded. Env key available:', cfg.hasEnvKey);
      }).catch((e) => {
        console.warn('[Tervox Modal] Failed to load server config:', e);
      });

      storage.getSettings().then((s) => {
        if (s.apiKey) {
          setApiKey(s.apiKey);
        }
      });
    }

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [isOpen, isSettingsMode]);

  if (!isOpen) return null;

  const handleActivate = async (keyToTest?: string) => {
    const key = (keyToTest !== undefined ? keyToTest : apiKey).trim();

    if (!key && !hasEnvKey) {
      setErrorMessage('Please enter your Google Gemini API key to proceed.');
      return;
    }

    // Reset previous states and begin loading
    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessInfo(null);
    setStatusMessage('Verifying connection with Google Gemini service...');
    console.log('[Tervox Modal] Verification triggered. Key entered:', Boolean(key));

    // Emergency safety timeout to guarantee loading state never hangs indefinitely
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      setIsVerifying((current) => {
        if (current) {
          console.warn('[Tervox Modal] Safety timeout reached (7s). Forcing stop loading.');
          setErrorMessage('Verification took longer than expected. Please check your network and retry.');
          setStatusMessage(null);
          return false;
        }
        return false;
      });
    }, 7000);

    try {
      const result = await gemini.verifyApiKey(key || undefined);
      console.log('[Tervox Modal] Verification response received:', result.ok, result.code);

      // Clear safety timeout as response has completed
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      if (result.ok) {
        setStatusMessage('Connection confirmed!');
        setSuccessInfo(result.message || 'Successfully connected to Gemini API.');

        // Save verified settings
        await storage.saveSettings({
          apiKey: key,
          isKeyVerified: true,
          hasSeenWelcome: true,
        });

        const masked = key
          ? `${key.slice(0, 6)}...${key.slice(-4)}`
          : 'Environment Key Active';

        // Brief confirmation before opening the main interface
        setTimeout(() => {
          setIsVerifying(false);
          onActivated(masked);
          if (onClose) onClose();
        }, 800);
      } else {
        setIsVerifying(false);
        setStatusMessage(null);

        if (result.code === 'QUOTA_EXCEEDED') {
          setErrorMessage('Tervox AI has reached the current API usage limit. Please try again later or review your API plan.');
        } else if (result.code === 'INVALID_API_KEY') {
          setErrorMessage('The provided Gemini API key is invalid or unauthorized. Please verify your key at Google AI Studio.');
        } else if (result.code === 'TIMEOUT') {
          setErrorMessage('The verification request timed out while contacting Gemini. Please verify your internet connection.');
        } else if (result.code === 'HIGH_DEMAND') {
          setErrorMessage('Gemini service is currently experiencing high demand. Please try again in a few moments.');
        } else {
          setErrorMessage(result.message || 'Failed to authenticate with Gemini API. Please check your credentials.');
        }
      }
    } catch (err: any) {
      console.error('[Tervox Modal] Unexpected error during activation:', err);
      setIsVerifying(false);
      setStatusMessage(null);
      setErrorMessage(err.message || 'Network error occurred while connecting. Please try again.');
    } finally {
      // In case result was not ok or failed before setting false
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl glass-panel-elevated p-6 sm:p-8 border border-cyan-500/30 text-slate-100 shadow-2xl">
        {/* Futuristic accent header lines */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal content */}
        <div className="relative z-10">
          {/* Brand & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4 glow-cyan">
              <Cpu className="w-7 h-7 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white flex items-center justify-center gap-2">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">Tervox AI</span>
            </h1>
            <p className="mt-2 text-sm text-slate-300 font-normal">
              Connect your AI to begin.
            </p>
          </div>

          {/* Quick notice if environment key is detected */}
          {hasEnvKey && (
            <div className="mb-5 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Default AI Studio Gemini Key is detected in your environment.</span>
              </div>
              <button
                type="button"
                onClick={() => handleActivate('')}
                disabled={isVerifying}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-medium cursor-pointer transition shrink-0"
              >
                Use Default
              </button>
            </div>
          )}

          {/* API Key Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <span>Google Gemini API Key</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Paste your Gemini API key (e.g. AIzaSy...)"
                  className="w-full bg-[#070d1e] text-slate-100 placeholder-slate-500 px-4 py-3 pr-12 rounded-xl border border-cyan-500/20 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-mono-code text-sm transition"
                  disabled={isVerifying}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? 'Hide API Key' : 'Show API Key'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 transition p-1"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Your key is stored securely in this browser profile and never hardcoded in source.
              </p>
            </div>

            {/* Verification Status Feedback */}
            {isVerifying && (
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center gap-3 text-cyan-300 text-xs">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-cyan-400" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Error Message Display with Retry Button */}
            {errorMessage && !isVerifying && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs space-y-2.5 animate-shake">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed flex-1">{errorMessage}</span>
                </div>
                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleActivate()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-100 text-xs font-semibold cursor-pointer transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Connection</span>
                  </button>
                </div>
              </div>
            )}

            {/* Success Display */}
            {successInfo && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successInfo}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => handleActivate()}
                disabled={isVerifying || (!apiKey.trim() && !hasEnvKey)}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-sm tracking-wide shadow-lg shadow-cyan-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Verifying with Gemini...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>Connect and Activate</span>
                  </>
                )}
              </button>

              {isSettingsMode && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isVerifying}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Security note */}
            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                Official Google Gemini API connection • Real-time status validation
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
