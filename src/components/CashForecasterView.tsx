import React from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid 
} from 'recharts';
import { CashPositionSnapshot, formatINR } from '../types/finance';

interface CashForecasterViewProps {
  cashPosition: CashPositionSnapshot | null;
  scenario: string;
  onScenarioChange: (scenario: string) => void;
}

export const CashForecasterView: React.FC<CashForecasterViewProps> = ({
  cashPosition,
  scenario,
  onScenarioChange,
}) => {
  if (!cashPosition) return null;

  const isLight = document.documentElement.classList.contains('light');

  const chartData = cashPosition.forecast_30d.map((d) => ({
    date: d.date.slice(5),
    fullDate: d.date,
    balance: d.projected_cash_inr,
    inflow: d.inflow_inr,
    outflow: d.outflow_inr,
    float: d.in_transit_float_inr,
    atRisk: d.at_risk_float_inr,
  }));

  return (
    <div className="mono-card rounded-xl p-5 mb-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-emphasis)] tracking-tight">
              Live Cash Position & 30-Day Forward Forecaster
            </h2>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] text-[11px] font-mono-finance">
              Float Adjusted
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-mono-finance mt-0.5">
            Cleared bank balances + pending in-flight gateway settlement float (T+1/T+2)
          </p>
        </div>

        {/* Scenario Buttons */}
        <div className="flex items-center gap-2 font-mono-finance text-xs">
          <span className="text-[var(--text-muted)]">Scenario:</span>
          <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-md p-0.5">
            {[
              { id: 'BASELINE', label: 'Baseline (T+2)' },
              { id: 'DELAYED_FLOAT', label: 'Holiday Lag (T+5)' },
              { id: 'EXPANSION_SPIKE', label: 'Surge (+25%)' },
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => onScenarioChange(sc.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  scenario === sc.id
                    ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                    : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Box Float Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5 font-mono-finance">
        <div className="bg-[var(--bg-inner)] p-3.5 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px] uppercase">Realized Cleared Cash</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-1">
            {formatINR(cashPosition.realized_cash_paise)}
          </div>
          <div className="text-[10px] text-[var(--text-sub)] mt-0.5">Bank ledger confirmed</div>
        </div>

        <div className="bg-[var(--bg-inner)] p-3.5 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px] uppercase">In-Transit Float (T+2)</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-1">
            {formatINR(cashPosition.in_transit_float_paise)}
          </div>
          <div className="text-[10px] text-[var(--text-sub)] mt-0.5">Clearing in 24–48 hours</div>
        </div>

        <div className="bg-[var(--bg-inner)] p-3.5 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px] uppercase">At-Risk Reserve Float</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-1">
            {formatINR(cashPosition.at_risk_float_paise)}
          </div>
          <div className="text-[10px] text-[var(--text-sub)] mt-0.5">Withheld / disputed</div>
        </div>

        <div className="bg-[var(--bg-inner)] p-3.5 rounded-lg border border-[var(--border-card)]">
          <div className="text-[var(--text-muted)] text-[11px] uppercase">Total Operating Runway</div>
          <div className="text-lg font-bold text-[var(--text-emphasis)] mt-1">
            {formatINR(cashPosition.realized_cash_paise + cashPosition.in_transit_float_paise)}
          </div>
          <div className="text-[10px] text-[var(--text-sub)] mt-0.5">Realized + In-Transit</div>
        </div>
      </div>

      {/* Monochrome Area Chart */}
      <div className="bg-[var(--bg-inner)] rounded-lg border border-[var(--border-card)] p-4 mb-5">
        <div className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider font-mono-finance mb-3">
          30-Day Forward Cash Balance (₹ INR)
        </div>

        <div className="h-64 w-full font-mono-finance">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="monoBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isLight ? "#94A3B8" : "#71717A"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isLight ? "#94A3B8" : "#71717A"} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke={isLight ? "#E2E8F0" : "#27272A"} vertical={false} />
              <XAxis dataKey="date" stroke={isLight ? "#64748B" : "#71717A"} fontSize={10} tickLine={false} />
              <YAxis 
                stroke={isLight ? "#64748B" : "#71717A"} 
                fontSize={10} 
                tickLine={false} 
                tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} 
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: isLight ? '#FFFFFF' : '#18181B',
                  borderColor: isLight ? '#CBD5E1' : '#3F3F46',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: isLight ? '#0F172A' : '#FAFAFA',
                }}
                formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke={isLight ? "#0F172A" : "#FFFFFF"} 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#monoBalance)" 
                name="Projected Balance" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-card)] bg-[var(--bg-inner)] max-h-56">
        <table className="w-full text-left text-xs border-collapse font-mono-finance">
          <thead>
            <tr className="mono-table-header uppercase text-[10px]">
              <th className="py-2 px-3.5 font-semibold">Forecast Date</th>
              <th className="py-2 px-3.5 font-semibold">Projected Inflow</th>
              <th className="py-2 px-3.5 font-semibold">Scheduled Outflows</th>
              <th className="py-2 px-3.5 font-semibold">Float Pipeline</th>
              <th className="py-2 px-3.5 text-right font-semibold">Projected Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {cashPosition.forecast_30d.slice(0, 8).map((d) => (
              <tr key={d.day} className="mono-table-row">
                <td className="py-2 px-3.5 text-[var(--text-main)]">
                  {d.date} {d.day === 0 && <span className="text-[10px] text-[var(--text-muted)] ml-1">(Today)</span>}
                </td>
                <td className="py-2 px-3.5 text-[var(--text-main)]">
                  +{d.inflow_inr.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </td>
                <td className="py-2 px-3.5 text-[var(--text-sub)]">
                  -{d.outflow_inr.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </td>
                <td className="py-2 px-3.5 text-[var(--text-muted)]">
                  {d.in_transit_float_inr.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </td>
                <td className="py-2 px-3.5 text-right font-bold text-[var(--text-emphasis)]">
                  {d.projected_cash_inr.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
