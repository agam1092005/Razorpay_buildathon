export type ReasonCode =
  | "DATE_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_ENTRY"
  | "MISSING_COUNTERPART"
  | "CURRENCY_MISMATCH"
  | "FEE_TAX_DISCREPANCY"
  | "PARTIAL_SETTLEMENT"
  | "UNRESOLVED_AMBIGUOUS";

export type MatchTier = "TIER_0_EXACT" | "TIER_1_FUZZY" | "TIER_N1_BATCH_NETTING";

export type RecordSource = "INTERNAL_LEDGER" | "RAZORPAY_SETTLEMENT" | "BANK_STATEMENT";

export type ResolutionStatus = "OPEN" | "RESOLVED" | "IN_DISPUTE" | "WRITTEN_OFF" | "ADJUSTED";

export type RemediationActionType =
  | "CREATE_ADJUSTING_JOURNAL"
  | "DISPUTE_GATEWAY_FEE"
  | "HOLD_FOR_NEXT_BATCH"
  | "WRITE_OFF_VARIANCE"
  | "FLAG_CHARGEBACK_RESERVE"
  | "REQUEST_BANK_ADVICE";

export interface LedgerRecord {
  record_id: string;
  order_id: string;
  payment_id: string;
  customer_id: string;
  amount_paise: number;
  currency: string;
  created_at: string;
  status: string;
  narration: string;
  is_refund: boolean;
  ground_truth_label?: string | null;
}

export interface SettlementRecord {
  settlement_id: string;
  utr: string;
  settlement_date: string;
  payment_ids: string[];
  gross_amount_paise: number;
  fee_amount_paise: number;
  tax_amount_paise: number;
  net_amount_paise: number;
  on_hold_amount_paise: number;
  status: string;
  narration: string;
}

export interface BankStatementRecord {
  bank_txn_id: string;
  utr: string;
  date: string;
  credit_paise: number;
  debit_paise: number;
  balance_paise: number;
  narration: string;
  matched_settlement_id?: string | null;
}

export interface MatchRecord {
  match_id: string;
  match_tier: MatchTier;
  confidence: number;
  matched_by: string;
  ledger_record_ids: string[];
  settlement_id?: string | null;
  bank_utr?: string | null;
  gross_paise: number;
  fee_paise: number;
  tax_paise: number;
  net_paise: number;
  audit_proof: string;
  timestamp: string;
}

export interface JournalEntry {
  entry_id: string;
  debit_account: string;
  credit_account: string;
  amount_paise: number;
  memo: string;
  created_at: string;
}

export interface RemediationProposal {
  action_type: RemediationActionType;
  title: string;
  explanation: string;
  journal_entry?: JournalEntry | null;
  suggested_dispute_memo?: string | null;
  requires_approval: boolean;
}

export interface ExceptionRecord {
  exception_id: string;
  source: RecordSource;
  source_record_id: string;
  related_payment_id?: string | null;
  related_order_id?: string | null;
  reason_code: ReasonCode;
  confidence: number;
  variance_paise: number;
  details: string;
  proposed_remediation: RemediationProposal;
  resolution_status: ResolutionStatus;
  ground_truth_label?: string | null;
  timestamp: string;
}

export interface DailyCashForecast {
  day: number;
  date: string;
  projected_cash_inr: number;
  inflow_inr: number;
  outflow_inr: number;
  in_transit_float_inr: number;
  at_risk_float_inr: number;
}

export interface CashPositionSnapshot {
  realized_cash_paise: number;
  in_transit_float_paise: number;
  at_risk_float_paise: number;
  fee_leakage_paise: number;
  total_ledger_sales_paise: number;
  as_of: string;
  forecast_30d: DailyCashForecast[];
}

export interface ClassificationMetric {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface EvaluationMetrics {
  total_records: number;
  auto_matched_count: number;
  match_rate_pct: number;
  exception_count: number;
  overall_accuracy_pct: number;
  throughput_ms: number;
  per_reason_metrics: Record<string, ClassificationMetric>;
  confusion_matrix: Record<string, Record<string, number>>;
}

export interface AppStateData {
  ledger_records: LedgerRecord[];
  settlement_records: SettlementRecord[];
  bank_records: BankStatementRecord[];
  matches: MatchRecord[];
  exceptions: ExceptionRecord[];
  cash_position: CashPositionSnapshot;
  eval_metrics: EvaluationMetrics;
  audit_log: Array<{ action: string; [key: string]: any }>;
  seed: number;
}

export function formatINR(paise: number): string {
  const inr = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(inr);
}

export function formatPaiseNumber(paise: number): string {
  const inr = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(inr);
}
