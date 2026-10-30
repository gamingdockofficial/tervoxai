import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Download,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Palette,
  Maximize2,
} from 'lucide-react';
import { gemini } from '../services/gemini';
import { GeneratedImage } from '../types';

interface ImageGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onImageGenerated?: (image: GeneratedImage) => void;
}

const STYLE_PRESETS = [
  { id: 'Cyberpunk', name: 'Cyberpunk Neon', desc: 'Futuristic glowing neon aesthetic' },
  { id: 'Photorealistic', name: 'Photorealistic 8K', desc: 'Ultra-high detail photographic render' },
  { id: '3D Render', name: '3D Octane Render', desc: 'Smooth volumetric lighting and textures' },
  { id: 'Digital Art', name: 'Digital Concept Art', desc: 'Cinematic fantasy and sci-fi illustration' },
  { id: 'Anime', name: 'Anime / Manga', desc: 'Japanese animation studio aesthetic' },
  { id: 'Minimalist', name: 'Minimalist Vector', desc: 'Clean geometric lines and bold colors' },
];

export const ImageGenModal: React.FC<ImageGenModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onImageGenerated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Cyberpunk');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImg, setGeneratedImg] = useState<GeneratedImage | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    const res = await gemini.generateImage({
      prompt: prompt.trim(),
      style: selectedStyle,
      apiKey,
    });

    setLoading(false);

    if (res.ok && res.imageUrl) {
      const newImg: GeneratedImage = {
        id: 'img_' + Date.now(),
        url: res.imageUrl,
        prompt: prompt.trim(),
        style: selectedStyle,
        createdAt: Date.now(),
      };
      setGeneratedImg(newImg);
      onImageGenerated?.(newImg);
    } else {
      setError(
        res.message ||
          'Failed to generate image. Please ensure your Gemini API key has access to image generation or try another prompt.'
      );
    }
  };

  const handleDownload = () => {
    if (!generatedImg) return;
    const a = document.createElement('a');
    a.href = generatedImg.url;
    a.download = `tervox_ai_gen_${Date.now()}.png`;
    a.click();
  };

  const handleCopyPrompt = () => {
    if (!generatedImg) return;
    navigator.clipboard.writeText(generatedImg.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                AI Image Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  Gemini Flash Image
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Generate high-definition visuals, concept art, and UI mockups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                Visual Description / Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A sleek, neon holographic humanoid AI assistant core in a dark futuristic server room with volumetric blue lighting..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                Select Aesthetic Style
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STYLE_PRESETS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedStyle === style.id
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-zinc-200">{style.name}</div>
                    <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Artwork...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Image
                </>
              )}
            </button>
          </form>

          {/* Error Notice */}
          {error && (
            <div className="p-3.5 bg-red-950/30 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-red-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-200">Generation Notice</p>
                <p className="mt-0.5 leading-relaxed text-red-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* Result Preview */}
          {generatedImg && (
            <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                  Generated Result
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPrompt}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg text-xs flex items-center gap-1 transition-colors"
                    title="Copy Prompt"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[11px]">Prompt</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-2.5 py-1 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download HD
                  </button>
                </div>
              </div>

              <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black flex items-center justify-center max-h-[380px]">
                <img
                  src={generatedImg.url}
                  alt={generatedImg.prompt}
                  className="w-full h-full object-contain max-h-[380px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>Powered by Gemini Image Model</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
