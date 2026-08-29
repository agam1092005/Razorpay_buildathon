import React, { useState } from 'react';
import { 
  RefreshCw, Sliders, Terminal, Sun, Moon 
} from 'lucide-react';

interface HeaderProps {
  currentSeed: number;
  batchSize: number;
  anomalyRate: number;
  scenario: string;
  isReconciling: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRunRecon: (size: number, anomaly: number, seed: number, scenario: string) => void;
  onOpenConfig: () => void;
  onOpenCopilot: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSeed,
  batchSize,
  anomalyRate,
  scenario,
  isReconciling,
  theme,
  onToggleTheme,
  onRunRecon,
  onOpenConfig,
  onOpenCopilot,
}) => {
  const [quickSize, setQuickSize] = useState<number>(batchSize);

  const handleQuickRun = (newSeed?: boolean) => {
    const nextSeed = newSeed ? Math.floor(Math.random() * 9000) + 1000 : currentSeed;
    onRunRecon(quickSize, anomalyRate, nextSeed, scenario);
  };

  return (
    <header className="border-b border-zinc-800/80 bg-[var(--bg-header)] sticky top-0 z-30 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Track Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white">
            <span className="font-mono-finance font-bold text-xs">RZ</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-[var(--text-main)] tracking-tight">
                Razorpay Recon
              </h1>
              <span className="text-[10px] font-mono-finance px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)]">
                Track 04 · AI Controller
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono-finance">
              Multi-source settlement reconciliation & forward cash forecasting
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Batch Size Selector */}
          <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-md p-0.5 text-xs font-mono-finance">
            <span className="text-[var(--text-muted)] px-2 text-[11px]">Batch:</span>
            {[50, 75, 120, 250].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setQuickSize(size);
                  onRunRecon(size, anomalyRate, currentSeed, scenario);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  batchSize === size
                    ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                    : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Seed Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-card)] text-[11px] text-[var(--text-sub)] font-mono-finance">
            <span className="text-[var(--text-muted)]">Seed:</span>
            <span className="text-[var(--text-main)] font-medium">#{currentSeed}</span>
          </div>

          {/* Shuffle Seed */}
          <button
            onClick={() => handleQuickRun(true)}
            disabled={isReconciling}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-sub)] hover:text-[var(--text-main)] text-xs font-medium border border-[var(--border-card)] transition-all disabled:opacity-50"
            title="Randomize seed to test accuracy against a fresh batch"
          >
            <RefreshCw className={`w-3 h-3 ${isReconciling ? 'animate-spin text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`} />
            <span>Shuffle</span>
          </button>

          {/* Chaos Config */}
          <button
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-sub)] hover:text-[var(--text-main)] text-xs font-medium border border-[var(--border-card)] transition-all"
          >
            <Sliders className="w-3 h-3 text-[var(--text-muted)]" />
            <span>Config</span>
          </button>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-sub)] hover:text-[var(--text-main)] text-xs font-medium border border-[var(--border-card)] transition-all"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-zinc-300" />
                <span className="hidden sm:inline font-mono-finance text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-zinc-700" />
                <span className="hidden sm:inline font-mono-finance text-[11px]">Dark</span>
              </>
            )}
          </button>

          {/* Settlement Q&A Copilot */}
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--pill-active-bg)] hover:opacity-90 text-[var(--pill-active-text)] text-xs font-semibold shadow-sm transition-all"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Settlement Q&A</span>
          </button>

        </div>
      </div>
    </header>
  );
};
