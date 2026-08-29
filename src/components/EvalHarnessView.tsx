import React from 'react';
import { RefreshCw } from 'lucide-react';
import { EvaluationMetrics } from '../types/finance';

interface EvalHarnessViewProps {
  metrics: EvaluationMetrics | null;
  currentSeed: number;
  onShuffleSeed: () => void;
}

export const EvalHarnessView: React.FC<EvalHarnessViewProps> = ({
  metrics,
  currentSeed,
  onShuffleSeed,
}) => {
  if (!metrics) return null;

  const classes = Object.keys(metrics.per_reason_metrics);

  return (
    <div className="mono-card rounded-xl p-5 mb-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-emphasis)] tracking-tight">
              Ground Truth Evaluation Harness & Benchmarks
            </h2>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] text-[11px] font-mono-finance">
              {metrics.overall_accuracy_pct}% Accuracy
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-mono-finance mt-0.5">
            Measured Precision, Recall & F1 against injected ground-truth mutations
          </p>
        </div>

        <button
          onClick={onShuffleSeed}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] text-xs font-semibold shadow-sm transition-all hover:opacity-90"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Test on Random Seed</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 font-mono-finance">
        <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px]">Records</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-0.5">{metrics.total_records}</div>
        </div>
        <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px]">Accuracy</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-0.5">{metrics.overall_accuracy_pct}%</div>
        </div>
        <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px]">Auto-Match Rate</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-0.5">{metrics.match_rate_pct}%</div>
        </div>
        <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px]">Latency</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-0.5">{metrics.throughput_ms} ms</div>
        </div>
      </div>

      {/* Benchmark Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-card)] bg-[var(--bg-inner)] mb-5">
        <table className="w-full text-left text-xs border-collapse font-mono-finance">
          <thead>
            <tr className="mono-table-header uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3.5 font-semibold">Classification Class</th>
              <th className="py-2.5 px-3.5 font-semibold">Support</th>
              <th className="py-2.5 px-3.5 font-semibold">Precision</th>
              <th className="py-2.5 px-3.5 font-semibold">Recall</th>
              <th className="py-2.5 px-3.5 font-semibold">F1 Score</th>
              <th className="py-2.5 px-3.5 text-right font-semibold">Confidence Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {classes.map((clsName) => {
              const m = metrics.per_reason_metrics[clsName];
              const isClean = clsName === 'CLEAN_MATCH';

              return (
                <tr key={clsName} className="mono-table-row">
                  <td className="py-2 px-3.5 font-medium text-[var(--text-main)]">
                    {clsName}
                  </td>
                  <td className="py-2 px-3.5 text-[var(--text-sub)]">
                    {m.support}
                  </td>
                  <td className="py-2 px-3.5 text-[var(--text-main)]">
                    {(m.precision * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 px-3.5 text-[var(--text-main)]">
                    {(m.recall * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 px-3.5 text-[var(--text-emphasis)] font-bold">
                    {m.f1_score.toFixed(3)}
                  </td>
                  <td className="py-2 px-3.5 text-right text-[var(--text-muted)] font-sans text-xs">
                    {isClean ? 'Deterministic 100%' : 'Gated Heuristic ≥95%'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confusion Matrix */}
      <div className="bg-[var(--bg-inner)] rounded-lg p-4 border border-[var(--border-card)] font-mono-finance">
        <div className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider mb-3">
          Confusion Matrix (Ground Truth vs Model Classification)
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-[11px] border-collapse">
            <thead>
              <tr className="text-[var(--text-muted)] bg-[var(--table-header-bg)] border-b border-[var(--border-card)]">
                <th className="py-2 px-2 text-left font-semibold">Truth \ Pred</th>
                {classes.map((c) => (
                  <th key={c} className="py-2 px-2 truncate max-w-[90px] font-semibold" title={c}>
                    {c.slice(0, 7)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {classes.map((trueCls) => (
                <tr key={trueCls}>
                  <td className="py-2 px-2 text-left font-semibold text-[var(--text-main)] truncate max-w-[100px]" title={trueCls}>
                    {trueCls}
                  </td>
                  {classes.map((predCls) => {
                    const count = metrics.confusion_matrix[trueCls]?.[predCls] || 0;
                    const isDiag = trueCls === predCls;
                    return (
                      <td
                        key={predCls}
                        className={`py-2 px-2 ${
                          count > 0 && isDiag
                            ? 'bg-[var(--bg-subtle)] text-[var(--text-emphasis)] font-bold'
                            : count > 0 && !isDiag
                            ? 'bg-[var(--bg-card-hover)] text-[var(--text-sub)] border border-[var(--border-card)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
