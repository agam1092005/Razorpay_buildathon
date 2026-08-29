import React from 'react';
import { MatchRecord, formatINR } from '../types/finance';

interface MatchDetailModalProps {
  match: MatchRecord | null;
  onClose: () => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({ match, onClose }) => {
  if (!match) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl max-w-lg w-full p-5 shadow-2xl relative font-mono-finance">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-bold bg-[var(--bg-subtle)] w-7 h-7 rounded-md border border-[var(--border-card)] flex items-center justify-center transition-all"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text-emphasis)] font-sans">Reconciliation Audit Proof</h3>
            <span className="px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-[10px] font-medium border border-[var(--border-card)]">
              {(match.confidence * 100).toFixed(0)}% Confidence
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{match.match_id}</p>
        </div>

        {/* Audit Proof String */}
        <div className="bg-[var(--bg-inner)] p-3 rounded-lg border border-[var(--border-card)] text-xs text-[var(--text-main)] leading-relaxed mb-4">
          {match.audit_proof}
        </div>

        {/* Math Breakdown */}
        <div className="bg-[var(--bg-inner)] rounded-lg p-3.5 border border-[var(--border-card)] mb-4 text-xs space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider font-sans mb-1">
            Settlement Netting Equation
          </div>

          <div className="flex items-center justify-between text-[var(--text-sub)]">
            <span>Σ Gross Sales ({match.ledger_record_ids.length} txns)</span>
            <span className="font-semibold text-[var(--text-emphasis)]">+{formatINR(match.gross_paise)}</span>
          </div>

          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span>− Contractual MDR (2.00%)</span>
            <span>-{formatINR(match.fee_paise)}</span>
          </div>

          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span>− GST Tax on MDR (18.00%)</span>
            <span>-{formatINR(match.tax_paise)}</span>
          </div>

          <div className="pt-2 border-t border-[var(--border-card)] flex items-center justify-between font-bold text-sm text-[var(--text-emphasis)]">
            <span>= Net Settled Bank Payout</span>
            <span>{formatINR(match.net_paise)}</span>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div className="bg-[var(--bg-subtle)] p-2 rounded border border-[var(--border-card)]">
            <span className="text-[var(--text-muted)] font-sans block text-[10px]">Settlement ID</span>
            <span className="text-[var(--text-main)] font-medium">{match.settlement_id || 'N/A'}</span>
          </div>
          <div className="bg-[var(--bg-subtle)] p-2 rounded border border-[var(--border-card)]">
            <span className="text-[var(--text-muted)] font-sans block text-[10px]">Bank UTR</span>
            <span className="text-[var(--text-main)] font-medium">{match.bank_utr || 'N/A'}</span>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] text-xs font-semibold font-sans transition-all hover:opacity-90 shadow-sm"
        >
          Close Audit Proof
        </button>

      </div>
    </div>
  );
};
