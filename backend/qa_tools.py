from __future__ import annotations
import json
import re
from typing import List, Dict, Any, Optional
from backend.models import (
    LedgerRecord, SettlementRecord, BankStatementRecord,
    MatchRecord, ExceptionRecord, ReasonCode,
    format_inr, paise_to_inr, CONTRACTUAL_MDR_RATE, GST_RATE_ON_MDR
)

class SettlementQAToolkit:
    """
    Parameterized deterministic tool layer for Settlement Q&A Agent:
    Guarantees 100% verified facts without SQL hallucination risks.
    """

    def __init__(
        self,
        ledger_records: List[LedgerRecord],
        settlement_records: List[SettlementRecord],
        bank_records: List[BankStatementRecord],
        matches: List[MatchRecord],
        exceptions: List[ExceptionRecord]
    ):
        self.ledger = ledger_records
        self.settlements = settlement_records
        self.bank = bank_records
        self.matches = matches
        self.exceptions = exceptions
        
        self.exc_by_id = {e.exception_id: e for e in exceptions}
        self.exc_by_payment = {e.related_payment_id: e for e in exceptions if e.related_payment_id}
        self.exc_by_source_id = {e.source_record_id: e for e in exceptions}
        self.settle_by_id = {s.settlement_id: s for s in settlement_records}
        self.match_by_settle = {m.settlement_id: m for m in matches if m.settlement_id}

    # Tool 1
    def get_exception_by_payment_id(self, payment_id: str) -> Dict[str, Any]:
        """Look up exception details, variance, and root cause by payment_id."""
        payment_id_clean = payment_id.strip()
        exc = self.exc_by_payment.get(payment_id_clean)
        
        if not exc:
            # Check if it was matched successfully
            for m in self.matches:
                for r_id in m.ledger_record_ids:
                    # check ledger
                    for r in self.ledger:
                        if r.record_id == r_id and r.payment_id == payment_id_clean:
                            return {
                                "status": "MATCHED",
                                "message": f"Payment {payment_id_clean} was successfully reconciled in Tier {m.match_tier.value}.",
                                "match_details": {
                                    "match_id": m.match_id,
                                    "settlement_id": m.settlement_id,
                                    "bank_utr": m.bank_utr,
                                    "gross": format_inr(m.gross_paise),
                                    "fee": format_inr(m.fee_paise),
                                    "net": format_inr(m.net_paise),
                                    "audit_proof": m.audit_proof
                                }
                            }
            return {
                "status": "NOT_FOUND",
                "message": f"No ledger record or exception found for payment_id '{payment_id_clean}'."
            }
            
        return {
            "status": "EXCEPTION_FOUND",
            "exception_id": exc.exception_id,
            "reason_code": exc.reason_code.value,
            "confidence": exc.confidence,
            "variance": format_inr(exc.variance_paise),
            "details": exc.details,
            "remediation": {
                "action_type": exc.proposed_remediation.action_type.value,
                "title": exc.proposed_remediation.title,
                "explanation": exc.proposed_remediation.explanation,
                "suggested_memo": exc.proposed_remediation.suggested_dispute_memo or (
                    f"Debit {exc.proposed_remediation.journal_entry.debit_account} / Credit {exc.proposed_remediation.journal_entry.credit_account}" if exc.proposed_remediation.journal_entry else None
                )
            }
        }

    # Tool 2
    def list_exceptions_by_reason(self, reason_code: str, limit: int = 5) -> Dict[str, Any]:
        """List open exceptions filtered by ReasonCode enum."""
        rc_clean = reason_code.strip().upper()
        matching_exceptions = [e for e in self.exceptions if e.reason_code.value == rc_clean]
        
        return {
            "query_reason_code": rc_clean,
            "total_found": len(matching_exceptions),
            "showing_count": min(limit, len(matching_exceptions)),
            "exceptions": [
                {
                    "exception_id": e.exception_id,
                    "source": e.source.value,
                    "payment_id": e.related_payment_id,
                    "order_id": e.related_order_id,
                    "variance": format_inr(e.variance_paise),
                    "details": e.details,
                    "recommended_action": e.proposed_remediation.title
                }
                for e in matching_exceptions[:limit]
            ]
        }

    # Tool 3
    def get_batch_summary_metrics(self) -> Dict[str, Any]:
        """Get high-level summary of total ingested ledger records, matches, exceptions, and match rate."""
        total_ledger = len(self.ledger)
        matched_ledger = sum(len(m.ledger_record_ids) for m in self.matches)
        match_rate = round((matched_ledger / max(1, total_ledger)) * 100.0, 2)
        
        total_gross_paise = sum(r.amount_paise for r in self.ledger)
        total_settled_net_paise = sum(m.net_paise for m in self.matches)
        total_exception_variance_paise = sum(e.variance_paise for e in self.exceptions)
        
        return {
            "total_ledger_records": total_ledger,
            "reconciled_records": matched_ledger,
            "match_rate_pct": match_rate,
            "exception_count": len(self.exceptions),
            "total_ledger_volume": format_inr(total_gross_paise),
            "total_settled_net_volume": format_inr(total_settled_net_paise),
            "open_exception_variance": format_inr(total_exception_variance_paise)
        }

    # Tool 4
    def explain_fee_variance(self, settlement_id: str) -> Dict[str, Any]:
        """Analyze MDR fee and GST deductions for a specific settlement batch vs contractual 2.0% rate."""
        settle = self.settle_by_id.get(settlement_id.strip())
        if not settle:
            return {"error": f"Settlement batch '{settlement_id}' not found."}
            
        expected_mdr_paise = int(round(settle.gross_amount_paise * CONTRACTUAL_MDR_RATE))
        expected_gst_paise = int(round(expected_mdr_paise * GST_RATE_ON_MDR))
        expected_total_deduction = expected_mdr_paise + expected_gst_paise
        
        actual_mdr_paise = settle.fee_amount_paise
        actual_gst_paise = settle.tax_amount_paise
        actual_total_deduction = actual_mdr_paise + actual_gst_paise
        
        variance_paise = actual_total_deduction - expected_total_deduction
        effective_mdr_rate_pct = round((actual_mdr_paise / max(1, settle.gross_amount_paise)) * 100.0, 3)
        
        return {
            "settlement_id": settle.settlement_id,
            "utr": settle.utr,
            "settlement_date": settle.settlement_date,
            "gross_volume": format_inr(settle.gross_amount_paise),
            "contractual_rate": "2.00% MDR + 18.00% GST on MDR",
            "effective_mdr_rate": f"{effective_mdr_rate_pct}%",
            "expected_deduction": {
                "mdr_fee": format_inr(expected_mdr_paise),
                "gst_tax": format_inr(expected_gst_paise),
                "total": format_inr(expected_total_deduction)
            },
            "actual_deduction": {
                "mdr_fee": format_inr(actual_mdr_paise),
                "gst_tax": format_inr(actual_gst_paise),
                "total": format_inr(actual_total_deduction)
            },
            "variance": format_inr(abs(variance_paise)),
            "is_overcharge": variance_paise > 0,
            "verdict": (
                f"Fee overcharge of {format_inr(variance_paise)} detected. Effective MDR was {effective_mdr_rate_pct}% vs contract 2.0%."
                if variance_paise > 5 else "Fees align exactly with contractual rate card."
            )
        }

    # Tool 5
    def propose_remediation(self, exception_id: str) -> Dict[str, Any]:
        """Generate human-in-the-loop remediation proposal with journal entry preview."""
        exc = self.exc_by_id.get(exception_id.strip())
        if not exc:
            return {"error": f"Exception '{exception_id}' not found."}
            
        rem = exc.proposed_remediation
        journal = None
        if rem.journal_entry:
            journal = {
                "entry_id": rem.journal_entry.entry_id,
                "debit_account": rem.journal_entry.debit_account,
                "credit_account": rem.journal_entry.credit_account,
                "amount": format_inr(rem.journal_entry.amount_paise),
                "memo": rem.journal_entry.memo,
                "created_at": rem.journal_entry.created_at
            }
            
        return {
            "exception_id": exc.exception_id,
            "reason_code": exc.reason_code.value,
            "action_type": rem.action_type.value,
            "title": rem.title,
            "explanation": rem.explanation,
            "journal_entry_preview": journal,
            "dispute_memo": rem.suggested_dispute_memo,
            "requires_human_confirmation": True
        }

    def answer_query(self, query: str) -> Dict[str, Any]:
        """
        Interprets user prompt, selects appropriate parameterized tool,
        and generates an explainable answer with execution trace.
        """
        q = query.lower()
        
        # 1. Check for specific payment_id query
        pay_match = re.search(r"(pay_[a-zA-Z0-9_]+)", query)
        if pay_match:
            pid = pay_match.group(1)
            tool_output = self.get_exception_by_payment_id(pid)
            return {
                "tool_called": "get_exception_by_payment_id",
                "parameters": {"payment_id": pid},
                "tool_output": tool_output,
                "answer": (
                    f"### Payment Verification Report for `{pid}`\n\n"
                    f"**Status**: {tool_output.get('status')}\n\n"
                    + (
                        f"- **Reason Code**: `{tool_output.get('reason_code')}`\n"
                        f"- **Variance**: **{tool_output.get('variance')}**\n"
                        f"- **Diagnosis**: {tool_output.get('details')}\n\n"
                        f"**Proposed Remediation**: {tool_output.get('remediation', {}).get('title')}\n"
                        f"_{tool_output.get('remediation', {}).get('explanation')}_"
                        if tool_output.get('status') == 'EXCEPTION_FOUND' else
                        f"- **Match Tier**: `{tool_output.get('match_details', {}).get('audit_proof')}`"
                    )
                )
            }
            
        # 2. Check for settlement fee inquiry
        setl_match = re.search(r"(setl_[a-zA-Z0-9_]+)", query)
        if setl_match or "fee" in q or "mdr" in q or "overcharge" in q:
            setl_id = setl_match.group(1) if setl_match else (self.settlements[0].settlement_id if self.settlements else "setl_RZP_501")
            tool_output = self.explain_fee_variance(setl_id)
            return {
                "tool_called": "explain_fee_variance",
                "parameters": {"settlement_id": setl_id},
                "tool_output": tool_output,
                "answer": (
                    f"### Fee & Tax Audit for Settlement `{setl_id}`\n\n"
                    f"- **Gross Volume**: {tool_output.get('gross_volume')}\n"
                    f"- **Effective MDR Charged**: `{tool_output.get('effective_mdr_rate')}` (Contract: `2.00%`)\n"
                    f"- **Actual Deduction**: MDR {tool_output.get('actual_deduction', {}).get('mdr_fee')} + GST {tool_output.get('actual_deduction', {}).get('gst_tax')} = **{tool_output.get('actual_deduction', {}).get('total')}**\n"
                    f"- **Expected Deduction**: {tool_output.get('expected_deduction', {}).get('total')}\n\n"
                    f"**Analysis**: {tool_output.get('verdict')}"
                )
            }
            
        # 3. Check for reason code inquiry (e.g. duplicates, missing, partial)
        for rc in ReasonCode:
            if rc.value.lower() in q or rc.name.lower().replace("_", " ") in q or ("duplicate" in q and rc == ReasonCode.DUPLICATE_ENTRY) or ("partial" in q and rc == ReasonCode.PARTIAL_SETTLEMENT) or ("float" in q and rc == ReasonCode.DATE_MISMATCH):
                tool_output = self.list_exceptions_by_reason(rc.value, limit=4)
                return {
                    "tool_called": "list_exceptions_by_reason",
                    "parameters": {"reason_code": rc.value, "limit": 4},
                    "tool_output": tool_output,
                    "answer": (
                        f"### Exceptions tagged with `{rc.value}`\n\n"
                        f"Found **{tool_output.get('total_found')}** items requiring attention.\n\n"
                        + "\n".join([
                            f"- **{e['exception_id']}** (Variance: {e['variance']}): {e['details']} → *{e['recommended_action']}*"
                            for e in tool_output.get('exceptions', [])
                        ])
                    )
                }

        # 4. Check for batch metrics & match rate
        if "rate" in q or "accuracy" in q or "summary" in q or "how many" in q or "metric" in q or "overview" in q or "run" in q:
            tool_output = self.get_batch_summary_metrics()
            return {
                "tool_called": "get_batch_summary_metrics",
                "parameters": {},
                "tool_output": tool_output,
                "answer": (
                    f"### Financial Controller Batch Reconciliation Summary\n\n"
                    f"- **Total Ingested Ledger Records**: `{tool_output.get('total_ledger_records')}`\n"
                    f"- **Auto-Reconciled Records**: `{tool_output.get('reconciled_records')}`\n"
                    f"- **Measured Match Rate**: **{tool_output.get('match_rate_pct')}%**\n"
                    f"- **Open Exceptions (Honest Triage)**: `{tool_output.get('exception_count')}`\n"
                    f"- **Total Gross Volume**: {tool_output.get('total_ledger_volume')}\n"
                    f"- **Net Cleared In Bank**: {tool_output.get('total_settled_net_volume')}\n"
                    f"- **Exception Variance**: {tool_output.get('open_exception_variance')}"
                )
            }

        # Default: Metrics + Tool recommendations
        tool_output = self.get_batch_summary_metrics()
        return {
            "tool_called": "get_batch_summary_metrics",
            "parameters": {},
            "tool_output": tool_output,
            "answer": (
                f"### Recon Controller Agent Status\n\n"
                f"Currently tracking **{tool_output.get('total_ledger_records')}** records with a **{tool_output.get('match_rate_pct')}%** automated match rate.\n\n"
                f"Try asking:\n"
                f"1. *'Why didn't payment pay_anom_1001 reconcile?'*\n"
                f"2. *'Explain the MDR fee variance on settlement setl_RZP_501'*\n"
                f"3. *'List all duplicate entries or partial settlement reserves'* \n"
                f"4. *'Show me our cash position and in-transit float'* "
            )
        }
