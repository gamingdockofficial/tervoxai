import React, { useState, useEffect } from 'react';
import { UserSettings, APIVerificationResult } from '../types';
import { storage } from '../services/storage';
import { gemini } from '../services/gemini';
import { speechService } from '../services/speech';
import {
  Settings as SettingsIcon,
  X,
  Key,
  Globe,
  Volume2,
  Trash2,
  ShieldCheck,
  Check,
  Sliders,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Info,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged: (updated: UserSettings) => void;
  onChangeKeyRequested?: () => void;
  onClearHistoryRequested: () => void;
  initialTab?: 'api' | 'voice' | 'language' | 'personality' | 'data';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsChanged,
  onClearHistoryRequested,
  initialTab = 'api',
}) => {
  const [activeTab, setActiveTab] = useState<'api' | 'voice' | 'language' | 'personality' | 'data'>(initialTab);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // API Key & Connection state
  const [newKeyInput, setNewKeyInput] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
    model?: string;
    isQuota?: boolean;
  } | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);

  // API Management Password Gate (Password: Tervox29102026)
  const [isApiUnlocked, setIsApiUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleUnlockApi = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (passwordInput.trim() === 'Tervox29102026') {
      setIsApiUnlocked(true);
      setPasswordError(null);
      setPasswordInput('');
    } else {
      setPasswordError('Incorrect password. Access denied.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      storage.getSettings().then((s) => {
        setSettings(s);
        setNewKeyInput(s.apiKey || '');
      });
      gemini.getServerConfig().then((cfg) => {
        setHasEnvKey(cfg.hasEnvKey);
      }).catch(() => {});
      const v = speechService.getAvailableVoices();
      setVoices(v);
      setTestResult(null);
      setKeySaveMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen || !settings) return null;

  const updateField = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = await storage.saveSettings({ [key]: value });
    setSettings(updated);
    onSettingsChanged(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };

  const handleTestConnection = async () => {
    const targetKey = newKeyInput.trim() || settings.apiKey;
    if (!targetKey && !hasEnvKey) {
      setTestResult({
        ok: false,
        message: 'Please enter a Gemini API key to test the connection.',
      });
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);
    setKeySaveMessage(null);

    const startTime = performance.now();
    try {
      const res: APIVerificationResult = await gemini.verifyApiKey(targetKey || undefined);
      const latencyMs = Math.round(performance.now() - startTime);

      const isQuota =
        res.code === 'QUOTA_EXCEEDED' ||
        res.message?.toLowerCase().includes('quota') ||
        res.message?.toLowerCase().includes('resource_exhausted');

      setTestResult({
        ok: res.ok,
        message: res.message || (res.ok ? 'Connection successful!' : 'Connection failed.'),
        latencyMs,
        model: res.model,
        isQuota,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'Unable to reach Gemini API endpoint.',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSaveApiKey = async () => {
    const cleanKey = newKeyInput.trim();

    if (!cleanKey && !hasEnvKey) {
      setTestResult({
        ok: false,
        message: 'Cannot save an empty key without an environment fallback.',
      });
      return;
    }

    setIsSavingKey(true);
    setKeySaveMessage(null);

    // Validate key before saving if changed
    if (cleanKey && cleanKey !== settings.apiKey) {
      const startTime = performance.now();
      const res = await gemini.verifyApiKey(cleanKey);
      const latencyMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        setIsSavingKey(false);
        const isQuota =
          res.code === 'QUOTA_EXCEEDED' ||
          res.message?.toLowerCase().includes('quota');
        setTestResult({
          ok: false,
          message: res.message || 'Verification failed. Key was not saved.',
          latencyMs,
          isQuota,
        });
        return;
      }
    }

    const updated = await storage.saveSettings({
      apiKey: cleanKey,
      isKeyVerified: true,
    });

    setSettings(updated);
    onSettingsChanged(updated);
    setIsSavingKey(false);
    setKeySaveMessage('API key successfully verified and applied to Tervox AI!');
    setTestResult({
      ok: true,
      message: 'Active and connected.',
    });
    setTimeout(() => setKeySaveMessage(null), 3000);
  };

  const handleRemoveKey = async () => {
    const updated = await storage.saveSettings({
      apiKey: '',
      isKeyVerified: hasEnvKey,
    });
    setSettings(updated);
    setNewKeyInput('');
    setTestResult(null);
    onSettingsChanged(updated);
    setKeySaveMessage(
      hasEnvKey
        ? 'Custom key removed. Reverted to server default API key.'
        : 'Custom key removed.'
    );
    setTimeout(() => setKeySaveMessage(null), 3000);
  };

  const handleResetAllData = async () => {
    await storage.clearAllData();
    window.location.reload();
  };

  const maskedActiveKey = settings.apiKey
    ? `${settings.apiKey.slice(0, 6)}••••••••${settings.apiKey.slice(-4)}`
    : hasEnvKey
    ? 'Environment Key Active (Pre-configured)'
    : 'No Key Configured';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl glass-panel-elevated border border-cyan-500/30 text-slate-100 shadow-2xl overflow-hidden">
        {/* Accent top stripe */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-cyan-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center glow-cyan">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-white">
                Tervox Settings
              </h2>
              <p className="text-xs text-slate-400">
                Manage your API connection, voice capabilities, and preferences.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'api'
                ? 'text-cyan-300 border-cyan-400 bg-cyan-950/30'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Key & Connection</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'voice'
                ? 'text-cyan-300 border-cyan-400 bg-cyan-950/30'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Voice & Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('language')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'language'
                ? 'text-cyan-300 border-cyan-400 bg-cyan-950/30'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Languages & Motion</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('personality')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'personality'
                ? 'text-cyan-300 border-cyan-400 bg-cyan-950/30'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personality & Memory</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'data'
                ? 'text-red-400 border-red-500 bg-red-950/20'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Data & Reset</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: API Key & Connection */}
          {activeTab === 'api' && !isApiUnlocked && (
            <div className="p-6 sm:p-8 rounded-2xl bg-[#090f1e]/90 border border-cyan-500/30 text-center space-y-5 animate-fade-in shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/10 glow-cyan">
                <Lock className="w-7 h-7 text-amber-400" />
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg font-bold font-display text-white">
                  API Management Access
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This section contains sensitive API credentials, rate limits, and key replacement settings. Enter the administrator password to unlock.
                </p>
              </div>

              <form onSubmit={handleUnlockApi} className="max-w-sm mx-auto space-y-3">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Enter password..."
                    className="w-full bg-[#050b16] border border-cyan-500/30 rounded-xl px-4 py-2.5 pr-11 text-xs font-mono-code text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 p-1 cursor-pointer transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordError && (
                  <div className="p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center justify-center gap-1.5 animate-shake">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition"
                >
                  Unlock API Management
                </button>

                <p className="text-[10.5px] text-slate-400 pt-1">
                  Client-side authentication gate active • Passphrase required.
                </p>
              </form>
            </div>
          )}

          {/* TAB 1 (Unlocked): API Key & Connection */}
          {activeTab === 'api' && isApiUnlocked && (
            <div className="space-y-5 animate-fade-in">
              {/* Unlocked status bar with lock option */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                <span className="flex items-center gap-1.5 text-[11px] font-medium">
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>API Management Unlocked</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsApiUnlocked(false)}
                  className="text-[11px] text-slate-400 hover:text-amber-200 flex items-center gap-1 underline cursor-pointer transition"
                >
                  <Lock className="w-3 h-3" />
                  <span>Lock Section</span>
                </button>
              </div>

              {/* Active Connection Status Card */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-cyan-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>Active Gemini Connection</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      settings.isKeyVerified
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        settings.isKeyVerified ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    {settings.isKeyVerified ? 'Connected & Verified' : 'Action Required'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <div>
                    <div className="text-[11px] text-slate-400">Current Key:</div>
                    <div className="font-mono-code text-xs text-cyan-300 mt-0.5 break-all">
                      {maskedActiveKey}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-slate-400">Models:</div>
                    <div className="text-xs text-slate-300 font-medium">
                      gemini-3.8-flash <span className="text-slate-500">•</span> gemini-3.8-live
                    </div>
                  </div>
                </div>
              </div>

              {/* Enter or Replace Key */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="api-key-input" className="text-xs font-semibold text-white flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Enter or Replace Gemini API Key</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                  >
                    <span>Get API Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    id="api-key-input"
                    type={showKeyText ? 'text' : 'password'}
                    value={newKeyInput}
                    onChange={(e) => {
                      setNewKeyInput(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#050b16] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 pr-20 text-xs font-mono-code text-cyan-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="p-1.5 text-slate-400 hover:text-cyan-300 rounded transition cursor-pointer"
                      title={showKeyText ? 'Hide API Key' : 'Show API Key'}
                    >
                      {showKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {newKeyInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewKeyInput('');
                          setTestResult(null);
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 transition"
                        title="Clear input"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Key action buttons: Test, Save, Remove */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingKey || isSavingKey}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-200 text-xs font-medium cursor-pointer transition disabled:opacity-50"
                  >
                    {isTestingKey ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Testing Connection...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    disabled={isTestingKey || isSavingKey || !newKeyInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 cursor-pointer transition disabled:opacity-50"
                  >
                    {isSavingKey ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save & Apply Key</span>
                      </>
                    )}
                  </button>

                  {settings.apiKey && (
                    <button
                      type="button"
                      onClick={handleRemoveKey}
                      disabled={isTestingKey || isSavingKey}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-red-950/40 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-300 text-xs transition cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Key</span>
                    </button>
                  )}
                </div>

                {/* Test Feedback banner */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                      testResult.ok
                        ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/40 border border-red-500/40 text-red-200'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 flex-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span>{testResult.ok ? 'Connection Verified' : 'Connection Failed'}</span>
                        {testResult.latencyMs !== undefined && (
                          <span className="font-mono-code text-[11px] opacity-80">
                            {testResult.latencyMs}ms latency
                          </span>
                        )}
                      </div>
                      <p className="leading-relaxed text-[11px]">{testResult.message}</p>
                      {testResult.model && (
                        <p className="text-[10px] opacity-75">
                          Verified Model: <span className="font-mono-code">{testResult.model}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Save Confirmation Message */}
                {keySaveMessage && (
                  <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-cyan-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{keySaveMessage}</span>
                  </div>
                )}
              </div>

              {/* Crucial Google Cloud Project Quota Callout */}
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-blue-300 font-semibold">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Important Note on Google Cloud Project Quotas</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Gemini API rate limits and quotas are shared per <strong>Google Cloud Project</strong>.
                  If you encounter an <span className="text-red-300 font-medium">"API quota reached"</span> error,
                  creating another key inside the <em>same</em> Google Cloud project will still hit the exact same quota limit.
                </p>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  To restore access immediately:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>
                    Create or select a <strong className="text-cyan-300">different Google Cloud Project</strong> in Google AI Studio.
                  </li>
                  <li>
                    Generate an API key under that new project and paste it above.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: Voice & Audio */}
          {activeTab === 'voice' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 space-y-4">
                {/* Voice output toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Voice Output Audio
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Enable speech synthesis audio for Tervox AI responses.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.voiceEnabled}
                      onChange={(e) => updateField('voiceEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Auto read responses */}
                {settings.voiceEnabled && (
                  <>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">
                          Auto-read Responses
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Automatically speak responses out loud in chat mode.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.autoSpeakResponse}
                          onChange={(e) => updateField('autoSpeakResponse', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>

                    {/* Speech Rate slider */}
                    <div className="pt-3 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-200">
                          Speech Rate (TTS)
                        </span>
                        <span className="text-xs text-cyan-300 font-mono-code">
                          {settings.speechRate.toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.3"
                        step="0.1"
                        value={settings.speechRate}
                        onChange={(e) => updateField('speechRate', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Gemini Live Voice Mode Info */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 space-y-2">
                <span className="text-xs font-semibold text-cyan-300 block">
                  Gemini Live Bidirectional Voice
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tervox features full-duplex conversational voice via Gemini Live (16kHz PCM streaming input & 24kHz output).
                  Click the phone call button on the glowing Orb to enter real-time conversational mode.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Languages & Motion */}
          {activeTab === 'language' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Preferred Language
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Auto-detects your input language by default.
                    </span>
                  </div>
                  <select
                    value={settings.preferredLanguage}
                    onChange={(e) => updateField('preferredLanguage', e.target.value)}
                    className="bg-[#060b19] border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs text-cyan-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="auto">Auto-Detect (Recommended)</option>
                    <option value="en">English</option>
                    <option value="ur">Urdu (اردو)</option>
                    <option value="ur-roman">Roman Urdu (Hinglish/Roman)</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="ar">Arabic (العربية)</option>
                    <option value="es">Spanish (Español)</option>
                    <option value="fr">French (Français)</option>
                  </select>
                </div>
              </div>

              {/* Performance & Motion */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Reduced Motion / Battery Saver
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Simplifies 3D canvas orb animations for low-end hardware.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.reducedMotion}
                    onChange={(e) => updateField('reducedMotion', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>
          )}

          {/* TAB: Personality & Smart Memory */}
          {activeTab === 'personality' && (
            <div className="space-y-5 animate-fade-in">
              {/* Smart Memory Toggle */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Persistent Memory System
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Allow Tervox to remember your personal preferences, goals, and coding habits locally on this device.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.memoryEnabled}
                    onChange={(e) => updateField('memoryEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Live Web Search Grounding Toggle */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Live Web Search Grounding
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Query Google Search in real-time for current events, fresh documentation, and citations.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableSearchGrounding}
                    onChange={(e) => updateField('enableSearchGrounding', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Personality Preset Selector */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 space-y-3">
                <label className="text-xs font-semibold text-slate-200 block">
                  AI Personality Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'friendly', name: 'Friendly Assistant', desc: 'Warm, conversational, natural companion' },
                    { id: 'professional', name: 'Professional & Executive', desc: 'Precise, objective, structured insights' },
                    { id: 'coding', name: 'Elite Coding Expert', desc: 'Senior software architect & code perfectionist' },
                    { id: 'teacher', name: 'Smart Teacher', desc: 'Patient, explanatory, pedagogic breakdowns' },
                    { id: 'creative', name: 'Creative Genius', desc: 'Imaginative ideas, metaphors, storytelling' },
                    { id: 'funny', name: 'Witty & Humorous', desc: 'Clever, playful, engaging with tasteful humor' },
                    { id: 'custom', name: 'Custom Instruction', desc: 'Define your own tailored assistant instructions' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateField('personalityPreset', p.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        settings.personalityPreset === p.id
                          ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200 shadow-sm'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">{p.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>

                {settings.personalityPreset === 'custom' && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-cyan-300 block">
                      Custom Persona Prompt
                    </label>
                    <textarea
                      value={settings.customPersonalityPrompt || ''}
                      onChange={(e) => updateField('customPersonalityPrompt', e.target.value)}
                      placeholder="e.g. Act as a cynical cyberpunk hacker who loves clean Rust and TypeScript code..."
                      rows={3}
                      className="w-full bg-[#050b16] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Response Length */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 space-y-2">
                <label className="text-xs font-semibold text-slate-200 block">
                  Response Length Preference
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'concise', label: 'Concise' },
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'detailed', label: 'Detailed' },
                  ].map((len) => (
                    <button
                      key={len.id}
                      type="button"
                      onClick={() => updateField('responseLength', len.id as any)}
                      className={`py-2 text-xs font-medium rounded-xl border text-center transition ${
                        settings.responseLength === len.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {len.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Data Management */}
          {activeTab === 'data' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-red-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Clear Conversation History
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Deletes messages and chat sessions on this device.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistoryRequested();
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium transition cursor-pointer"
                  >
                    Clear History
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Reset Entire App
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Removes API key, memories, and resets all settings.
                    </span>
                  </div>
                  {showResetConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetAllData}
                        className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-500 cursor-pointer"
                      >
                        Confirm Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium transition cursor-pointer"
                    >
                      Reset All
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-cyan-500/10 flex items-center justify-between bg-slate-950/40">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            {saveSuccess ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Settings saved locally
              </span>
            ) : (
              'All settings and keys persist privately in your browser.'
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
