import React from 'react';
import { EvaluationMetrics, CashPositionSnapshot, formatINR } from '../types/finance';

interface MetricsBannerProps {
  metrics: EvaluationMetrics | null;
  cashPosition: CashPositionSnapshot | null;
  totalSettlements: number;
}

export const MetricsBanner: React.FC<MetricsBannerProps> = ({
  metrics,
  cashPosition,
  totalSettlements,
}) => {
  if (!metrics || !cashPosition) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
      
      {/* 1. Ingested Batch */}
      <div className="mono-card rounded-lg p-3.5 flex flex-col justify-between">
        <div className="text-[var(--text-muted)] text-[11px] font-mono-finance uppercase tracking-wider">
          Ingested Batch
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold text-[var(--text-emphasis)] font-mono-finance tracking-tight">
            {metrics.total_records} <span className="text-xs font-normal text-[var(--text-muted)]">records</span>
          </div>
          <div className="text-[11px] text-[var(--text-sub)] mt-0.5 font-mono-finance">
            {formatINR(cashPosition.total_ledger_sales_paise)}
          </div>
        </div>
      </div>

      {/* 2. Auto-Match Rate */}
      <div className="mono-card rounded-lg p-3.5 flex flex-col justify-between">
        <div className="text-[var(--text-sub)] text-[11px] font-mono-finance uppercase tracking-wider flex items-center justify-between">
          <span>Match Rate</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-emphasis)]"></span>
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold text-[var(--text-emphasis)] font-mono-finance tracking-tight">
            {metrics.match_rate_pct}%
          </div>
          <div className="text-[11px] text-[var(--text-sub)] mt-0.5 font-mono-finance">
            {metrics.auto_matched_count}/{metrics.total_records} auto-closed
          </div>
        </div>
      </div>

      {/* 3. Latency Throughput */}
      <div className="mono-card rounded-lg p-3.5 flex flex-col justify-between">
        <div className="text-[var(--text-muted)] text-[11px] font-mono-finance uppercase tracking-wider">
          Latency
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold text-[var(--text-emphasis)] font-mono-finance tracking-tight">
            {metrics.throughput_ms} <span className="text-xs font-normal text-[var(--text-muted)]">ms</span>
          </div>
          <div className="text-[11px] text-[var(--text-sub)] mt-0.5 font-mono-finance">
            {(metrics.total_records / (metrics.throughput_ms / 1000)).toFixed(0)} rec/sec
          </div>
        </div>
      </div>

      {/* 4. Exceptions */}
      <div className="mono-card rounded-lg p-3.5 flex flex-col justify-between">
        <div className="text-[var(--text-main)] text-[11px] font-mono-finance uppercase tracking-wider flex items-center justify-between">
          <span>Exceptions</span>
          <span className="text-[10px] px-1 bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] rounded">Triage</span>
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold text-[var(--text-emphasis)] font-mono-finance tracking-tight">
            {metrics.exception_count} <span className="text-xs font-normal text-[var(--text-muted)]">open</span>
          </div>
          <div className="text-[11px] text-[var(--text-sub)] mt-0.5 font-mono-finance">
            {formatINR(cashPosition.at_risk_float_paise)} at-risk
          </div>
        </div>
      </div>

      {/* 5. Fee Leakage */}
      <div className="mono-card rounded-lg p-3.5 flex flex-col justify-between">
        <div className="text-[var(--text-muted)] text-[11px] font-mono-finance uppercase tracking-wider">
          Fee Leakage
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold text-[var(--text-emphasis)] font-mono-finance tracking-tight">
            {formatINR(cashPosition.fee_leakage_paise)}
          </div>
          <div className="text-[11px] text-[var(--text-sub)] mt-0.5 font-mono-finance">
            MDR + GST variance
          </div>
        </div>
      </div>

      {/* 6. Realized Cash */}
      <div className="mono-card rounded-lg p-3.5 flex flex-col justify-between">
        <div className="text-[var(--text-muted)] text-[11px] font-mono-finance uppercase tracking-wider">
          Realized Cash
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold text-[var(--text-emphasis)] font-mono-finance tracking-tight">
            {formatINR(cashPosition.realized_cash_paise)}
          </div>
          <div className="text-[11px] text-[var(--text-sub)] mt-0.5 font-mono-finance">
            Float: {formatINR(cashPosition.in_transit_float_paise)}
          </div>
        </div>
      </div>

    </div>
  );
};
