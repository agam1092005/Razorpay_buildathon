import React, { useState } from 'react';
import { ExceptionRecord, ReasonCode, formatINR } from '../types/finance';

interface ExceptionTriageHubProps {
  exceptions: ExceptionRecord[];
  onRemediate: (exceptionId: string, actionType: string, notes?: string) => Promise<void>;
}

export const ExceptionTriageHub: React.FC<ExceptionTriageHubProps> = ({
  exceptions,
  onRemediate,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('ALL');
  const [remediatingId, setRemediatingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const filteredExceptions = exceptions.filter((exc) => {
    if (selectedReason !== 'ALL' && exc.reason_code !== selectedReason) return false;
    return true;
  });

  const handleActionClick = async (exc: ExceptionRecord) => {
    setRemediatingId(exc.exception_id);
    try {
      await onRemediate(exc.exception_id, exc.proposed_remediation.action_type, exc.proposed_remediation.title);
      setResolvedIds((prev) => new Set(prev).add(exc.exception_id));
    } finally {
      setRemediatingId(null);
    }
  };

  const reasonCodeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of exceptions) {
      counts[e.reason_code] = (counts[e.reason_code] || 0) + 1;
    }
    return counts;
  }, [exceptions]);

  return (
    <div className="mono-card rounded-xl p-5 mb-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-emphasis)] tracking-tight">
              Exception Triage Queue & Remediation Hub
            </h2>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] text-[11px] font-mono-finance">
              {exceptions.length} breaks
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-mono-finance mt-0.5">
            Strict break isolation with deterministic root cause classification and adjusting entries
          </p>
        </div>

        {/* Reason Code Filter */}
        <div className="flex flex-wrap items-center gap-1 bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-md p-1 text-xs font-mono-finance">
          <button
            onClick={() => setSelectedReason('ALL')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
              selectedReason === 'ALL'
                ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
            }`}
          >
            All ({exceptions.length})
          </button>
          {Object.entries(reasonCodeCounts).map(([code, count]) => (
            <button
              key={code}
              onClick={() => setSelectedReason(code)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                selectedReason === code
                  ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
              }`}
            >
              {code.replace('_', ' ')} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredExceptions.length === 0 ? (
          <div className="col-span-2 py-10 text-center text-[var(--text-muted)] font-sans text-xs">
            No exceptions currently in this category.
          </div>
        ) : (
          filteredExceptions.map((exc) => {
            const isResolved = resolvedIds.has(exc.exception_id) || exc.resolution_status === 'RESOLVED';
            const isBusy = remediatingId === exc.exception_id;
            const journal = exc.proposed_remediation.journal_entry;

            return (
              <div
                key={exc.exception_id}
                className={`rounded-lg border p-4 flex flex-col justify-between transition-all ${
                  isResolved
                    ? 'bg-[var(--bg-inner)] border-[var(--border-card)] opacity-60'
                    : 'bg-[var(--bg-inner)] border-[var(--border-card)] hover:border-[var(--border-card-hover)]'
                }`}
              >
                <div>
                  {/* Top: Reason + Variance */}
                  <div className="flex items-center justify-between gap-2 mb-2 font-mono-finance">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-card)] text-[10px] font-medium">
                      {exc.reason_code}
                    </span>
                    <div className="text-right">
                      <span className="text-[11px] text-[var(--text-muted)]">Variance: </span>
                      <span className="text-xs font-bold text-[var(--text-emphasis)]">
                        {formatINR(exc.variance_paise)}
                      </span>
                    </div>
                  </div>

                  {/* References */}
                  <div className="text-[11px] font-mono-finance text-[var(--text-muted)] mb-2 flex flex-wrap gap-x-3 gap-y-1">
                    {exc.related_payment_id && (
                      <div>Ref: <span className="text-[var(--text-main)] font-medium">{exc.related_payment_id}</span></div>
                    )}
                    {exc.related_order_id && (
                      <div>Order: <span className="text-[var(--text-main)]">{exc.related_order_id}</span></div>
                    )}
                  </div>

                  {/* Diagnosis */}
                  <p className="text-xs text-[var(--text-main)] bg-[var(--bg-subtle)] p-2.5 rounded border border-[var(--border-card)] mb-3 leading-relaxed">
                    {exc.details}
                  </p>

                  {/* Journal Entry Preview */}
                  {journal && (
                    <div className="bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded p-2.5 mb-3 text-[11px] font-mono-finance">
                      <div className="text-[var(--text-muted)] font-semibold text-[10px] uppercase tracking-wider mb-1">
                        Proposed Adjusting Entry
                      </div>
                      <div className="text-[var(--text-main)] flex justify-between">
                        <span>Dr. {journal.debit_account}</span>
                        <span className="text-[var(--text-emphasis)] font-bold">{formatINR(journal.amount_paise)}</span>
                      </div>
                      <div className="text-[var(--text-sub)] flex justify-between pl-3 mt-0.5">
                        <span>Cr. {journal.credit_account}</span>
                        <span className="text-[var(--text-main)]">{formatINR(journal.amount_paise)}</span>
                      </div>
                    </div>
                  )}

                  {exc.proposed_remediation.suggested_dispute_memo && (
                    <div className="bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded p-2.5 mb-3 text-[11px]">
                      <div className="text-[var(--text-muted)] font-semibold text-[10px] uppercase tracking-wider mb-1 font-mono-finance">
                        Gateway Dispute Memo
                      </div>
                      <p className="text-[var(--text-main)] font-mono-finance text-[10px] whitespace-pre-line bg-[var(--bg-inner)] p-2 rounded border border-[var(--border-card)]">
                        {exc.proposed_remediation.suggested_dispute_memo}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-[var(--border-card)] flex items-center justify-between gap-3 mt-1 font-sans">
                  <div className="text-[11px] text-[var(--text-muted)] font-mono-finance">
                    Human Confirm-to-Execute
                  </div>

                  {isResolved ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)]">
                      Resolved & Posted
                    </span>
                  ) : (
                    <button
                      onClick={() => handleActionClick(exc)}
                      disabled={isBusy}
                      className="px-3 py-1 rounded bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] text-xs font-semibold shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {isBusy ? 'Posting...' : exc.proposed_remediation.title}
                    </button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
