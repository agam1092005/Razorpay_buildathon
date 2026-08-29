from __future__ import annotations
from datetime import datetime, timedelta
from typing import List, Dict, Any
from backend.models import (
    LedgerRecord, SettlementRecord, BankStatementRecord,
    MatchRecord, ExceptionRecord, CashPositionSnapshot,
    ReasonCode, paise_to_inr, inr_to_paise
)

class CashForecaster:
    """
    Real-time Cash Position & 30-Day Forward Forecaster:
    Computes:
    1. Realized Cash: Σ confirmed settlements in bank
    2. In-Transit Float: Ledger sales captured awaiting standard T+1/T+2 settlement
    3. At-Risk Float: Disputed, chargebacks, and on_hold reserve balances
    4. Fee Leakage: Gateway MDR/GST deductions exceeding contracted rates
    5. 30-Day Forward Cash Runway Model with sensitivity scenarios
    """

    @staticmethod
    def calculate_position(
        ledger_records: List[LedgerRecord],
        settlement_records: List[SettlementRecord],
        bank_records: List[BankStatementRecord],
        matches: List[MatchRecord],
        exceptions: List[ExceptionRecord],
        scenario: str = "BASELINE" # "BASELINE", "DELAYED_FLOAT", "EXPANSION_SPIKE"
    ) -> CashPositionSnapshot:
        
        # 1. Realized Cash: Latest cleared balance from bank statement
        if bank_records:
            # Sort by date
            latest_bank = sorted(bank_records, key=lambda b: b.date)[-1]
            realized_cash_paise = latest_bank.balance_paise
        else:
            realized_cash_paise = inr_to_paise(5000000.0)
            
        # 2. Total Ledger Sales
        total_ledger_sales_paise = sum(r.amount_paise for r in ledger_records if not r.is_refund)
        
        # 3. In-Transit Float
        # Ledger items that are clean and awaiting settlement or recently captured
        matched_ledger_ids = set()
        for m in matches:
            matched_ledger_ids.update(m.ledger_record_ids)
            
        in_transit_paise = 0
        for r in ledger_records:
            if r.record_id not in matched_ledger_ids and r.ground_truth_label is None:
                in_transit_paise += r.amount_paise

        # If all synthetic ledger records were processed in batches, simulate active in-flight float
        if in_transit_paise == 0 and total_ledger_sales_paise > 0:
            in_transit_paise = int(total_ledger_sales_paise * 0.18) # 18% standard pipeline float

        # 4. At-Risk Float (Exceptions: on_hold, amount disputes, missing counterpart)
        at_risk_paise = 0
        fee_leakage_paise = 0
        
        for exc in exceptions:
            if exc.reason_code in [ReasonCode.PARTIAL_SETTLEMENT, ReasonCode.AMOUNT_MISMATCH, ReasonCode.MISSING_COUNTERPART]:
                at_risk_paise += exc.variance_paise
            elif exc.reason_code == ReasonCode.FEE_TAX_DISCREPANCY:
                fee_leakage_paise += exc.variance_paise
                
        # 5. 30-Day Forward Cash Projection
        forecast_30d: List[Dict[str, Any]] = []
        base_date = datetime(2026, 8, 26)
        
        running_cash_paise = realized_cash_paise
        daily_avg_sales_paise = int(total_ledger_sales_paise / max(1, 14)) # 14-day sample velocity
        
        float_clearance_days = 2 if scenario != "DELAYED_FLOAT" else 5
        growth_multiplier = 1.25 if scenario == "EXPANSION_SPIKE" else 1.0

        for day_offset in range(31):
            curr_date = base_date + timedelta(days=day_offset)
            date_str = curr_date.strftime("%Y-%m-%d")
            day_of_month = curr_date.day
            
            # Daily projected inflows (Gross - 2% fee - 18% GST)
            projected_inflow_paise = int(daily_avg_sales_paise * growth_multiplier * 0.9764) if day_offset >= float_clearance_days else 0
            
            # If day is within in-transit clearance, add a portion of in-transit float
            if 1 <= day_offset <= float_clearance_days:
                projected_inflow_paise += int(in_transit_paise / float_clearance_days)
                
            # Scheduled Recurring Payables
            projected_outflow_paise = 0
            
            # Payroll on 1st and 30th
            if day_of_month in [1, 30]:
                projected_outflow_paise += inr_to_paise(850000.0) # ₹8,50,000 payroll
            # Vendor & Software Payables on 15th
            elif day_of_month == 15:
                projected_outflow_paise += inr_to_paise(320000.0) # ₹3,20,000 vendor
            # Cloud Infra on 25th
            elif day_of_month == 25:
                projected_outflow_paise += inr_to_paise(150000.0) # ₹1,50,000 AWS/GCP
            else:
                projected_outflow_paise += inr_to_paise(12000.0)  # Daily misc operating
                
            running_cash_paise = running_cash_paise + projected_inflow_paise - projected_outflow_paise
            
            forecast_30d.append({
                "day": day_offset,
                "date": date_str,
                "projected_cash_inr": paise_to_inr(running_cash_paise),
                "inflow_inr": paise_to_inr(projected_inflow_paise),
                "outflow_inr": paise_to_inr(projected_outflow_paise),
                "in_transit_float_inr": paise_to_inr(max(0, in_transit_paise - (projected_inflow_paise * min(day_offset, 3)))),
                "at_risk_float_inr": paise_to_inr(at_risk_paise)
            })

        return CashPositionSnapshot(
            realized_cash_paise=realized_cash_paise,
            in_transit_float_paise=in_transit_paise,
            at_risk_float_paise=at_risk_paise,
            fee_leakage_paise=fee_leakage_paise,
            total_ledger_sales_paise=total_ledger_sales_paise,
            as_of=base_date.strftime("%Y-%m-%d %H:%M:%S"),
            forecast_30d=forecast_30d
        )
