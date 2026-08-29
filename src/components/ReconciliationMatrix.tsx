import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { 
  LedgerRecord, SettlementRecord, BankStatementRecord, 
  MatchRecord, ExceptionRecord, formatINR 
} from '../types/finance';

interface ReconciliationMatrixProps {
  ledgerRecords: LedgerRecord[];
  settlementRecords: SettlementRecord[];
  bankRecords: BankStatementRecord[];
  matches: MatchRecord[];
  exceptions: ExceptionRecord[];
  onSelectMatch: (match: MatchRecord) => void;
  onSelectException: (exception: ExceptionRecord) => void;
}

export const ReconciliationMatrix: React.FC<ReconciliationMatrixProps> = ({
  ledgerRecords,
  settlementRecords,
  bankRecords,
  matches,
  exceptions,
  onSelectMatch,
  onSelectException,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'MATCHED' | 'EXCEPTIONS' | 'N1_BATCHES'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const matchByLedgerId = React.useMemo(() => {
    const map = new Map<string, MatchRecord>();
    for (const m of matches) {
      for (const id of m.ledger_record_ids) {
        map.set(id, m);
      }
    }
    return map;
  }, [matches]);

  const exceptionByLedgerId = React.useMemo(() => {
    const map = new Map<string, ExceptionRecord>();
    for (const e of exceptions) {
      if (e.source_record_id) map.set(e.source_record_id, e);
      if (e.related_payment_id) {
        for (const r of ledgerRecords) {
          if (r.payment_id === e.related_payment_id) {
            map.set(r.record_id, e);
          }
        }
      }
    }
    return map;
  }, [exceptions, ledgerRecords]);

  const settlementById = React.useMemo(() => {
    const map = new Map<string, SettlementRecord>();
    for (const s of settlementRecords) {
      map.set(s.settlement_id, s);
    }
    return map;
  }, [settlementRecords]);

  const bankByUtr = React.useMemo(() => {
    const map = new Map<string, BankStatementRecord>();
    for (const b of bankRecords) {
      if (b.utr && b.utr !== 'UTR_UNAVAILABLE') {
        map.set(b.utr, b);
      }
    }
    return map;
  }, [bankRecords]);

  const filteredLedger = React.useMemo(() => {
    return ledgerRecords.filter((record) => {
      const match = matchByLedgerId.get(record.record_id);
      const exc = exceptionByLedgerId.get(record.record_id);

      if (filterType === 'MATCHED' && !match) return false;
      if (filterType === 'EXCEPTIONS' && !exc) return false;
      if (filterType === 'N1_BATCHES' && (!match || match.match_tier !== 'TIER_N1_BATCH_NETTING')) return false;

      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesTerm =
          record.payment_id.toLowerCase().includes(term) ||
          record.order_id.toLowerCase().includes(term) ||
          record.narration.toLowerCase().includes(term) ||
          (match && match.settlement_id && match.settlement_id.toLowerCase().includes(term)) ||
          (match && match.bank_utr && match.bank_utr.toLowerCase().includes(term));
        if (!matchesTerm) return false;
      }

      return true;
    });
  }, [ledgerRecords, matchByLedgerId, exceptionByLedgerId, filterType, searchTerm]);

  return (
    <div className="mono-card rounded-xl p-5 mb-8">
      
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-emphasis)] tracking-tight">
            3-Way Reconciliation Ledger Matrix
          </h2>
          <p className="text-xs text-[var(--text-muted)] font-mono-finance mt-0.5">
            Internal Billing Ledger ↔ Razorpay Payout Batches ↔ Bank Statement Feeds
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search reference, UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-card-hover)] transition-all font-mono-finance"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-md p-0.5 text-xs font-mono-finance">
            {(['ALL', 'MATCHED', 'N1_BATCHES', 'EXCEPTIONS'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  filterType === type
                    ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                    : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                }`}
              >
                {type === 'ALL' && 'All'}
                {type === 'MATCHED' && 'Matched'}
                {type === 'N1_BATCHES' && 'N:1 Netting'}
                {type === 'EXCEPTIONS' && 'Exceptions'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-card)] bg-[var(--bg-inner)]">
        <table className="w-full text-left text-xs border-collapse font-mono-finance">
          <thead>
            <tr className="mono-table-header uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3.5 font-semibold">Internal Ledger (AR)</th>
              <th className="py-2.5 px-3.5 font-semibold">Gross (INR)</th>
              <th className="py-2.5 px-3.5 font-semibold">Settlement Batch</th>
              <th className="py-2.5 px-3.5 font-semibold">Fees & GST</th>
              <th className="py-2.5 px-3.5 font-semibold">Bank Credit</th>
              <th className="py-2.5 px-3.5 font-semibold">Verification</th>
              <th className="py-2.5 px-3.5 text-right font-semibold">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredLedger.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--text-muted)] font-sans text-xs">
                  No records match filter.
                </td>
              </tr>
            ) : (
              filteredLedger.map((record) => {
                const match = matchByLedgerId.get(record.record_id);
                const exc = exceptionByLedgerId.get(record.record_id);

                return (
                  <tr 
                    key={record.record_id}
                    className="mono-table-row cursor-pointer"
                    onClick={() => {
                      if (match) onSelectMatch(match);
                      else if (exc) onSelectException(exc);
                    }}
                  >
                    {/* Col 1 */}
                    <td className="py-2.5 px-3.5">
                      <div className="font-semibold text-[var(--text-emphasis)]">
                        {record.payment_id}
                        {record.currency !== 'INR' && (
                          <span className="ml-1.5 text-[10px] px-1 bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] rounded">
                            {record.currency}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px]">
                        {record.narration}
                      </div>
                    </td>

                    {/* Col 2 */}
                    <td className="py-2.5 px-3.5 font-bold text-[var(--text-emphasis)]">
                      {formatINR(record.amount_paise)}
                    </td>

                    {/* Col 3 */}
                    <td className="py-2.5 px-3.5">
                      {match?.settlement_id ? (
                        <div>
                          <div className="text-[var(--text-main)] font-medium">
                            {match.settlement_id}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[150px]">
                            {match.bank_utr}
                          </div>
                        </div>
                      ) : exc ? (
                        <span className="text-[var(--text-sub)] text-[11px] font-sans">
                          {exc.reason_code}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Col 4 */}
                    <td className="py-2.5 px-3.5 text-[var(--text-sub)]">
                      {match ? (
                        <div>
                          <div>-{formatINR(match.fee_paise)}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">GST: -{formatINR(match.tax_paise)}</div>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Col 5 */}
                    <td className="py-2.5 px-3.5">
                      {match?.bank_utr ? (
                        <span className="text-[var(--text-emphasis)] font-semibold">
                          +{formatINR(match.net_paise)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-[10px]">In-Transit</span>
                      )}
                    </td>

                    {/* Col 6 */}
                    <td className="py-2.5 px-3.5">
                      {match ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-card)] text-[10px] font-medium font-sans">
                          {match.match_tier === 'TIER_N1_BATCH_NETTING' ? 'N:1 Net Verified' : 'Exact Match'}
                        </span>
                      ) : exc ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] text-[10px] font-medium font-sans">
                          Exception
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-[10px]">Pending</span>
                      )}
                    </td>

                    {/* Col 7 */}
                    <td className="py-2.5 px-3.5 text-right font-sans">
                      {match ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMatch(match);
                          }}
                          className="px-2 py-0.5 rounded bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] text-[var(--btn-secondary-text)] text-[11px] font-medium border border-[var(--border-card)] transition-all"
                        >
                          Proof
                        </button>
                      ) : exc ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectException(exc);
                          }}
                          className="px-2 py-0.5 rounded bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] text-[11px] font-medium transition-all"
                        >
                          Triage
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
