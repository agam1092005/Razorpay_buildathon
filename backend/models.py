from __future__ import annotations
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, date

class ReasonCode(str, Enum):
    DATE_MISMATCH = "DATE_MISMATCH"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"
    MISSING_COUNTERPART = "MISSING_COUNTERPART"
    CURRENCY_MISMATCH = "CURRENCY_MISMATCH"
    FEE_TAX_DISCREPANCY = "FEE_TAX_DISCREPANCY"
    PARTIAL_SETTLEMENT = "PARTIAL_SETTLEMENT"
    UNRESOLVED_AMBIGUOUS = "UNRESOLVED_AMBIGUOUS"

class MatchTier(str, Enum):
    TIER_0_EXACT = "TIER_0_EXACT"
    TIER_1_FUZZY = "TIER_1_FUZZY"
    TIER_N1_BATCH_NETTING = "TIER_N1_BATCH_NETTING"

class RecordSource(str, Enum):
    INTERNAL_LEDGER = "INTERNAL_LEDGER"
    RAZORPAY_SETTLEMENT = "RAZORPAY_SETTLEMENT"
    BANK_STATEMENT = "BANK_STATEMENT"

class ResolutionStatus(str, Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"
    IN_DISPUTE = "IN_DISPUTE"
    WRITTEN_OFF = "WRITTEN_OFF"
    ADJUSTED = "ADJUSTED"

class RemediationActionType(str, Enum):
    CREATE_ADJUSTING_JOURNAL = "CREATE_ADJUSTING_JOURNAL"
    DISPUTE_GATEWAY_FEE = "DISPUTE_GATEWAY_FEE"
    HOLD_FOR_NEXT_BATCH = "HOLD_FOR_NEXT_BATCH"
    WRITE_OFF_VARIANCE = "WRITE_OFF_VARIANCE"
    FLAG_CHARGEBACK_RESERVE = "FLAG_CHARGEBACK_RESERVE"
    REQUEST_BANK_ADVICE = "REQUEST_BANK_ADVICE"

CONTRACTUAL_MDR_RATE = 0.02  # 2.0%
GST_RATE_ON_MDR = 0.18        # 18% GST on MDR

def paise_to_inr(paise: int) -> float:
    return round(paise / 100.0, 2)

def inr_to_paise(inr: float) -> int:
    return int(round(inr * 100))

def format_inr(paise: int) -> str:
    inr_val = paise_to_inr(paise)
    return f"₹{inr_val:,.2f}"

class LedgerRecord(BaseModel):
    record_id: str
    order_id: str
    payment_id: str
    customer_id: str
    amount_paise: int  # Stored in paise (integer)
    currency: str = "INR"
    created_at: str
    status: str = "CAPTURED"
    narration: str
    is_refund: bool = False
    ground_truth_label: Optional[str] = None  # None if matched, or ReasonCode string if injected anomaly

    @property
    def amount_inr(self) -> float:
        return paise_to_inr(self.amount_paise)

class SettlementRecord(BaseModel):
    settlement_id: str
    utr: str
    settlement_date: str
    payment_ids: List[str] = Field(default_factory=list)
    gross_amount_paise: int
    fee_amount_paise: int
    tax_amount_paise: int  # 18% GST on MDR
    net_amount_paise: int
    on_hold_amount_paise: int = 0
    status: str = "SETTLED"
    narration: str

    @property
    def gross_inr(self) -> float:
        return paise_to_inr(self.gross_amount_paise)
    @property
    def fee_inr(self) -> float:
        return paise_to_inr(self.fee_amount_paise)
    @property
    def tax_inr(self) -> float:
        return paise_to_inr(self.tax_amount_paise)
    @property
    def net_inr(self) -> float:
        return paise_to_inr(self.net_amount_paise)

class BankStatementRecord(BaseModel):
    bank_txn_id: str
    utr: str
    date: str
    credit_paise: int = 0
    debit_paise: int = 0
    balance_paise: int
    narration: str
    matched_settlement_id: Optional[str] = None

    @property
    def credit_inr(self) -> float:
        return paise_to_inr(self.credit_paise)
    @property
    def debit_inr(self) -> float:
        return paise_to_inr(self.debit_paise)
    @property
    def balance_inr(self) -> float:
        return paise_to_inr(self.balance_paise)

class MatchRecord(BaseModel):
    match_id: str
    match_tier: MatchTier
    confidence: float
    matched_by: str
    ledger_record_ids: List[str]
    settlement_id: Optional[str] = None
    bank_utr: Optional[str] = None
    gross_paise: int
    fee_paise: int
    tax_paise: int
    net_paise: int
    audit_proof: str
    timestamp: str

class JournalEntry(BaseModel):
    entry_id: str
    debit_account: str
    credit_account: str
    amount_paise: int
    memo: str
    created_at: str

class RemediationProposal(BaseModel):
    action_type: RemediationActionType
    title: str
    explanation: str
    journal_entry: Optional[JournalEntry] = None
    suggested_dispute_memo: Optional[str] = None
    requires_approval: bool = True

class ExceptionRecord(BaseModel):
    exception_id: str
    source: RecordSource
    source_record_id: str
    related_payment_id: Optional[str] = None
    related_order_id: Optional[str] = None
    reason_code: ReasonCode
    confidence: float
    variance_paise: int
    details: str
    proposed_remediation: RemediationProposal
    resolution_status: ResolutionStatus = ResolutionStatus.OPEN
    ground_truth_label: Optional[str] = None
    timestamp: str

class CashPositionSnapshot(BaseModel):
    realized_cash_paise: int
    in_transit_float_paise: int
    at_risk_float_paise: int
    fee_leakage_paise: int
    total_ledger_sales_paise: int
    as_of: str
    forecast_30d: List[Dict[str, Any]]

class ClassificationMetric(BaseModel):
    precision: float
    recall: float
    f1_score: float
    support: int

class EvaluationMetrics(BaseModel):
    total_records: int
    auto_matched_count: int
    match_rate_pct: float
    exception_count: int
    overall_accuracy_pct: float
    throughput_ms: float
    per_reason_metrics: Dict[str, ClassificationMetric]
    confusion_matrix: Dict[str, Dict[str, int]]
