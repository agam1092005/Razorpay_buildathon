import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface BatchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSize: number;
  currentAnomalyRate: number;
  currentSeed: number;
  currentScenario: string;
  onApply: (size: number, anomalyRate: number, seed: number, scenario: string) => void;
}

export const BatchConfigModal: React.FC<BatchConfigModalProps> = ({
  isOpen,
  onClose,
  currentSize,
  currentAnomalyRate,
  currentSeed,
  currentScenario,
  onApply,
}) => {
  const [size, setSize] = useState<number>(currentSize);
  const [anomalyRate, setAnomalyRate] = useState<number>(currentAnomalyRate);
  const [seed, setSeed] = useState<number>(currentSeed);
  const [scenario, setScenario] = useState<string>(currentScenario);

  if (!isOpen) return null;

  const applyPreset = (presetSize: number, presetAnomaly: number, presetScenario: string) => {
    setSize(presetSize);
    setAnomalyRate(presetAnomaly);
    setScenario(presetScenario);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl max-w-md w-full p-5 shadow-2xl relative font-sans">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-bold bg-[var(--bg-subtle)] w-7 h-7 rounded-md border border-[var(--border-card)] flex items-center justify-center transition-all"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-[var(--text-emphasis)]">Batch & Mutation Configuration</h3>
          <p className="text-xs text-[var(--text-muted)] font-mono-finance mt-0.5">Control volume, anomaly injection, and seed</p>
        </div>

        {/* Presets */}
        <div className="mb-5">
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-2 font-mono-finance">
            Presets
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono-finance">
            <button
              onClick={() => applyPreset(60, 0.05, 'BASELINE')}
              className="p-2 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] text-left transition-all"
            >
              <div className="font-semibold text-[var(--text-emphasis)] text-[11px]">Clean Run</div>
              <div className="text-[10px] text-[var(--text-muted)]">95%+ Match</div>
            </button>
            <button
              onClick={() => applyPreset(100, 0.15, 'BASELINE')}
              className="p-2 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] text-left transition-all"
            >
              <div className="font-semibold text-[var(--text-emphasis)] text-[11px]">Realistic</div>
              <div className="text-[10px] text-[var(--text-muted)]">85% Match</div>
            </button>
            <button
              onClick={() => applyPreset(150, 0.30, 'DELAYED_FLOAT')}
              className="p-2 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] text-left transition-all"
            >
              <div className="font-semibold text-[var(--text-emphasis)] text-[11px]">Stress Test</div>
              <div className="text-[10px] text-[var(--text-muted)]">70% Match</div>
            </button>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-3.5 mb-5 text-xs font-mono-finance">
          {/* Slider 1 */}
          <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)]">
            <div className="flex justify-between items-center mb-1.5 font-sans">
              <span className="text-[var(--text-main)]">Batch Volume:</span>
              <span className="text-[var(--text-emphasis)] font-bold font-mono-finance">{size} records</span>
            </div>
            <input
              type="range"
              min={25}
              max={300}
              step={5}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full accent-[var(--text-emphasis)] cursor-pointer"
            />
          </div>

          {/* Slider 2 */}
          <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)]">
            <div className="flex justify-between items-center mb-1.5 font-sans">
              <span className="text-[var(--text-main)]">Mutation Rate:</span>
              <span className="text-[var(--text-emphasis)] font-bold font-mono-finance">{(anomalyRate * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={0.4}
              step={0.05}
              value={anomalyRate}
              onChange={(e) => setAnomalyRate(Number(e.target.value))}
              className="w-full accent-[var(--text-emphasis)] cursor-pointer"
            />
          </div>

          {/* Seed Input */}
          <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)] flex items-center justify-between font-sans">
            <span className="text-[var(--text-main)]">Random Seed:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-20 bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-2 py-1 text-center font-mono-finance text-xs text-[var(--text-main)] focus:outline-none"
              />
              <button
                onClick={() => setSeed(Math.floor(Math.random() * 9000) + 1000)}
                className="p-1 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-card)]"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] text-[var(--text-main)] text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(size, anomalyRate, seed, scenario);
              onClose();
            }}
            className="flex-1 py-2 rounded-lg bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] text-xs font-semibold shadow-sm transition-all hover:opacity-90"
          >
            Apply & Reconcile
          </button>
        </div>

      </div>
    </div>
  );
};
