from __future__ import annotations
import random
from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Any
from backend.models import (
    LedgerRecord, SettlementRecord, BankStatementRecord,
    ReasonCode, inr_to_paise
)

CONTRACTUAL_MDR_RATE = 0.02  # 2.0%
GST_RATE_ON_MDR = 0.18        # 18% GST on MDR

CUSTOMER_NAMES = [
    "TechNova Solutions", "CloudScale Retail", "Aura Enterprises", "Zenith Logistics",
    "Apex Global", "BlueSky Health", "OmniVenture India", "Nexus Payments Co",
    "Starlight Commerce", "Prism Infotech", "Solaria Energy", "Vanguard Media",
    "Equinox Labs", "Horizon FinTech", "Quantum Softwares", "Titanium Supply"
]

def generate_synthetic_batch(
    total_ledger_records: int = 60,
    anomaly_rate: float = 0.15,
    seed: int = 42
) -> Tuple[List[LedgerRecord], List[SettlementRecord], List[BankStatementRecord]]:
    """
    Generates a synchronized, realistic batch of synthetic finance data:
    - Internal Ledger records (Orders/Payments in Paise)
    - Razorpay Settlement batches (with N:1 netting, MDR fees, GST on fees)
    - Bank statement entries (with matching UTRs and credit lines)
    - Deliberately injected labeled ground-truth mutations for testing/evaluation.
    """
    rng = random.Random(seed)
    base_date = datetime(2026, 8, 10, 10, 0, 0)
    
    ledger_records: List[LedgerRecord] = []
    settlement_records: List[SettlementRecord] = []
    bank_records: List[BankStatementRecord] = []
    
    current_bank_balance_paise = inr_to_paise(5000000.0) # Starting balance: ₹50,00,000
    
    # 1. Determine anomaly count & pick target indices
    num_anomalies = max(4, int(total_ledger_records * anomaly_rate))
    clean_count = total_ledger_records - num_anomalies
    
    # Distribute anomalies across the 8 fixed Reason Codes
    reason_codes_pool = [
        ReasonCode.DATE_MISMATCH,
        ReasonCode.AMOUNT_MISMATCH,
        ReasonCode.DUPLICATE_ENTRY,
        ReasonCode.MISSING_COUNTERPART,
        ReasonCode.CURRENCY_MISMATCH,
        ReasonCode.FEE_TAX_DISCREPANCY,
        ReasonCode.PARTIAL_SETTLEMENT,
        ReasonCode.UNRESOLVED_AMBIGUOUS,
    ]
    
    anomaly_assignments = []
    for i in range(num_anomalies):
        anomaly_assignments.append(reason_codes_pool[i % len(reason_codes_pool)])
    rng.shuffle(anomaly_assignments)
    
    # Track assigned record index
    rec_counter = 1000
    settle_counter = 500
    bank_counter = 800
    
    # 2. Build Clean Transactions: Mix of 1:1 and N:1 Net Batches
    # Group clean transactions into batches of size 1 to 5
    clean_records_generated = 0
    while clean_records_generated < clean_count:
        batch_size = rng.choice([1, 1, 2, 3, 4, 5])
        batch_size = min(batch_size, clean_count - clean_records_generated)
        
        batch_ledger_items: List[LedgerRecord] = []
        batch_gross_paise = 0
        batch_payment_ids: List[str] = []
        
        batch_date = base_date + timedelta(days=clean_records_generated // 8, hours=rng.randint(0, 12))
        settle_date = batch_date + timedelta(days=2) # T+2 settlement standard
        
        for _ in range(batch_size):
            rec_counter += 1
            order_id = f"order_RZP{rec_counter}"
            payment_id = f"pay_live_{rec_counter}{rng.randint(100, 999)}"
            customer = rng.choice(CUSTOMER_NAMES)
            
            # Amount between ₹1,500 and ₹75,000
            amt_inr = rng.randint(15, 750) * 100 + rng.choice([0, 50, 99])
            amt_paise = inr_to_paise(amt_inr)
            
            narration = f"PG Capture {customer} Ref: {order_id}"
            
            ledger_item = LedgerRecord(
                record_id=f"led_{rec_counter}",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=batch_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=narration,
                ground_truth_label=None # Clean, expected to auto-match
            )
            batch_ledger_items.append(ledger_item)
            batch_payment_ids.append(payment_id)
            batch_gross_paise += amt_paise
            ledger_records.append(ledger_item)
            clean_records_generated += 1
            
        # Calculate Razorpay fee and GST for clean batch
        # MDR Fee = 2.0% of Gross; GST = 18% of MDR Fee
        fee_paise = int(round(batch_gross_paise * CONTRACTUAL_MDR_RATE))
        tax_paise = int(round(fee_paise * GST_RATE_ON_MDR))
        net_paise = batch_gross_paise - fee_paise - tax_paise
        
        settle_counter += 1
        settle_id = f"setl_RZP_{settle_counter}"
        utr = f"RBIP202608{rng.randint(10000000, 99999999)}"
        
        settle_record = SettlementRecord(
            settlement_id=settle_id,
            utr=utr,
            settlement_date=settle_date.strftime("%Y-%m-%d"),
            payment_ids=batch_payment_ids,
            gross_amount_paise=batch_gross_paise,
            fee_amount_paise=fee_paise,
            tax_amount_paise=tax_paise,
            net_amount_paise=net_paise,
            status="SETTLED",
            narration=f"Razorpay Payout Batch {settle_id} ({len(batch_payment_ids)} txns) UTR: {utr}"
        )
        settlement_records.append(settle_record)
        
        # Bank Statement credit line
        bank_counter += 1
        current_bank_balance_paise += net_paise
        bank_record = BankStatementRecord(
            bank_txn_id=f"bank_tx_{bank_counter}",
            utr=utr,
            date=settle_date.strftime("%Y-%m-%d"),
            credit_paise=net_paise,
            debit_paise=0,
            balance_paise=current_bank_balance_paise,
            narration=f"NEFT CR-RAZORPAY SOFTWARE PVT LTD-{utr}-SETTLEMENT",
            matched_settlement_id=settle_id
        )
        bank_records.append(bank_record)

    # 3. Inject Labeled Anomalies
    for anomaly_code in anomaly_assignments:
        rec_counter += 1
        order_id = f"order_ANOM_{rec_counter}"
        payment_id = f"pay_anom_{rec_counter}{rng.randint(100, 999)}"
        customer = rng.choice(CUSTOMER_NAMES)
        amt_inr = rng.randint(20, 600) * 100
        amt_paise = inr_to_paise(amt_inr)
        
        anom_date = base_date + timedelta(days=rng.randint(1, 14), hours=rng.randint(0, 12))
        
        if anomaly_code == ReasonCode.DATE_MISMATCH:
            # Shift settlement date by 14 days (outside standard float window)
            ledger_item = LedgerRecord(
                record_id=f"led_{rec_counter}",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=anom_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"PG Capture {customer} Order {order_id}",
                ground_truth_label=ReasonCode.DATE_MISMATCH.value
            )
            ledger_records.append(ledger_item)
            
            fee_paise = int(round(amt_paise * CONTRACTUAL_MDR_RATE))
            tax_paise = int(round(fee_paise * GST_RATE_ON_MDR))
            net_paise = amt_paise - fee_paise - tax_paise
            
            settle_counter += 1
            delayed_date = anom_date + timedelta(days=15)
            utr = f"RBIP202608{rng.randint(10000000, 99999999)}"
            settle_record = SettlementRecord(
                settlement_id=f"setl_RZP_{settle_counter}",
                utr=utr,
                settlement_date=delayed_date.strftime("%Y-%m-%d"),
                payment_ids=[payment_id],
                gross_amount_paise=amt_paise,
                fee_amount_paise=fee_paise,
                tax_amount_paise=tax_paise,
                net_amount_paise=net_paise,
                status="SETTLED",
                narration=f"Delayed Settlement for {payment_id} UTR: {utr}"
            )
            settlement_records.append(settle_record)
            
            bank_counter += 1
            current_bank_balance_paise += net_paise
            bank_records.append(BankStatementRecord(
                bank_txn_id=f"bank_tx_{bank_counter}",
                utr=utr,
                date=delayed_date.strftime("%Y-%m-%d"),
                credit_paise=net_paise,
                balance_paise=current_bank_balance_paise,
                narration=f"NEFT CR-RAZORPAY SOFTWARE PVT LTD-{utr}-DELAYED"
            ))

        elif anomaly_code == ReasonCode.AMOUNT_MISMATCH:
            # Ledger has ₹50,000, but settlement has ₹48,000 (discrepancy of ₹2,000)
            diff_paise = inr_to_paise(2000.0)
            settled_gross = amt_paise - diff_paise
            
            ledger_item = LedgerRecord(
                record_id=f"led_{rec_counter}",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=anom_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"PG Capture {customer} Order {order_id}",
                ground_truth_label=ReasonCode.AMOUNT_MISMATCH.value
            )
            ledger_records.append(ledger_item)
            
            fee_paise = int(round(settled_gross * CONTRACTUAL_MDR_RATE))
            tax_paise = int(round(fee_paise * GST_RATE_ON_MDR))
            net_paise = settled_gross - fee_paise - tax_paise
            
            settle_counter += 1
            utr = f"RBIP202608{rng.randint(10000000, 99999999)}"
            settle_record = SettlementRecord(
                settlement_id=f"setl_RZP_{settle_counter}",
                utr=utr,
                settlement_date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                payment_ids=[payment_id],
                gross_amount_paise=settled_gross, # Discrepancy here
                fee_amount_paise=fee_paise,
                tax_amount_paise=tax_paise,
                net_amount_paise=net_paise,
                status="SETTLED",
                narration=f"Settlement with amount variance for {payment_id}"
            )
            settlement_records.append(settle_record)
            
            bank_counter += 1
            current_bank_balance_paise += net_paise
            bank_records.append(BankStatementRecord(
                bank_txn_id=f"bank_tx_{bank_counter}",
                utr=utr,
                date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                credit_paise=net_paise,
                balance_paise=current_bank_balance_paise,
                narration=f"NEFT CR-RAZORPAY-{utr}-DISCREPANCY"
            ))

        elif anomaly_code == ReasonCode.DUPLICATE_ENTRY:
            # Two ledger records for the exact same payment_id (e.g. duplicate webhook processed)
            ledger_item1 = LedgerRecord(
                record_id=f"led_{rec_counter}_A",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=anom_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"PG Capture {customer} Order {order_id}",
                ground_truth_label=ReasonCode.DUPLICATE_ENTRY.value
            )
            ledger_item2 = LedgerRecord(
                record_id=f"led_{rec_counter}_B",
                order_id=f"{order_id}_DUP",
                payment_id=payment_id, # Duplicate payment ID
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=(anom_date + timedelta(minutes=2)).strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"PG Capture Duplicate Webhook {order_id}",
                ground_truth_label=ReasonCode.DUPLICATE_ENTRY.value
            )
            ledger_records.extend([ledger_item1, ledger_item2])
            
            fee_paise = int(round(amt_paise * CONTRACTUAL_MDR_RATE))
            tax_paise = int(round(fee_paise * GST_RATE_ON_MDR))
            net_paise = amt_paise - fee_paise - tax_paise
            
            settle_counter += 1
            utr = f"RBIP202608{rng.randint(10000000, 99999999)}"
            settlement_records.append(SettlementRecord(
                settlement_id=f"setl_RZP_{settle_counter}",
                utr=utr,
                settlement_date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                payment_ids=[payment_id],
                gross_amount_paise=amt_paise,
                fee_amount_paise=fee_paise,
                tax_amount_paise=tax_paise,
                net_amount_paise=net_paise,
                status="SETTLED",
                narration=f"Razorpay Single Payout for {payment_id}"
            ))
            bank_counter += 1
            current_bank_balance_paise += net_paise
            bank_records.append(BankStatementRecord(
                bank_txn_id=f"bank_tx_{bank_counter}",
                utr=utr,
                date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                credit_paise=net_paise,
                balance_paise=current_bank_balance_paise,
                narration=f"NEFT CR-RAZORPAY-{utr}"
            ))

        elif anomaly_code == ReasonCode.MISSING_COUNTERPART:
            # Case: Ledger has capture, but settlement never arrived (failed gateway payout)
            ledger_item = LedgerRecord(
                record_id=f"led_{rec_counter}",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=anom_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"PG Capture {customer} [DROPPED IN TRANSIT]",
                ground_truth_label=ReasonCode.MISSING_COUNTERPART.value
            )
            ledger_records.append(ledger_item)
            # No settlement and no bank record generated!

        elif anomaly_code == ReasonCode.CURRENCY_MISMATCH:
            # Cross-border payment with foreign exchange mismatch
            ledger_item = LedgerRecord(
                record_id=f"led_{rec_counter}",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="USD", # Stored in USD currency
                created_at=anom_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"International Payment USD 500 via Razorpay",
                ground_truth_label=ReasonCode.CURRENCY_MISMATCH.value
            )
            ledger_records.append(ledger_item)
            
            # Settlement settles in INR with different fx conversion
            settled_inr_paise = inr_to_paise(41250.0) # $500 @ 82.50 vs expected 83.50
            fee_paise = int(round(settled_inr_paise * 0.03)) # 3% international fee
            tax_paise = int(round(fee_paise * GST_RATE_ON_MDR))
            net_paise = settled_inr_paise - fee_paise - tax_paise
            
            settle_counter += 1
            utr = f"RBIP202608{rng.randint(10000000, 99999999)}"
            settlement_records.append(SettlementRecord(
                settlement_id=f"setl_RZP_{settle_counter}",
                utr=utr,
                settlement_date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                payment_ids=[payment_id],
                gross_amount_paise=settled_inr_paise,
                fee_amount_paise=fee_paise,
                tax_amount_paise=tax_paise,
                net_amount_paise=net_paise,
                status="SETTLED",
                narration=f"Intl Settlement FX Adjusted {payment_id}"
            ))
            bank_counter += 1
            current_bank_balance_paise += net_paise
            bank_records.append(BankStatementRecord(
                bank_txn_id=f"bank_tx_{bank_counter}",
                utr=utr,
                date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                credit_paise=net_paise,
                balance_paise=current_bank_balance_paise,
                narration=f"NEFT CR-RAZORPAY INTL-{utr}"
            ))

        elif anomaly_code == ReasonCode.FEE_TAX_DISCREPANCY:
            # Gateway charged 2.85% MDR instead of contracted 2.0% -> Fee Leakage!
            ledger_item = LedgerRecord(
                record_id=f"led_{rec_counter}",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=anom_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"PG Capture {customer} Order {order_id}",
                ground_truth_label=ReasonCode.FEE_TAX_DISCREPANCY.value
            )
            ledger_records.append(ledger_item)
            
            # Excessive MDR fee
            inflated_fee_paise = int(round(amt_paise * 0.0285)) # 2.85% MDR
            tax_paise = int(round(inflated_fee_paise * GST_RATE_ON_MDR))
            net_paise = amt_paise - inflated_fee_paise - tax_paise
            
            settle_counter += 1
            utr = f"RBIP202608{rng.randint(10000000, 99999999)}"
            settlement_records.append(SettlementRecord(
                settlement_id=f"setl_RZP_{settle_counter}",
                utr=utr,
                settlement_date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                payment_ids=[payment_id],
                gross_amount_paise=amt_paise,
                fee_amount_paise=inflated_fee_paise, # Overcharge!
                tax_amount_paise=tax_paise,
                net_amount_paise=net_paise,
                status="SETTLED",
                narration=f"Settlement with elevated MDR fee for {payment_id}"
            ))
            bank_counter += 1
            current_bank_balance_paise += net_paise
            bank_records.append(BankStatementRecord(
                bank_txn_id=f"bank_tx_{bank_counter}",
                utr=utr,
                date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                credit_paise=net_paise,
                balance_paise=current_bank_balance_paise,
                narration=f"NEFT CR-RAZORPAY-{utr}"
            ))

        elif anomaly_code == ReasonCode.PARTIAL_SETTLEMENT:
            # Razorpay withheld on_hold_amount (e.g. risk reserve or partial refund reserve)
            on_hold_paise = inr_to_paise(15000.0)
            ledger_item = LedgerRecord(
                record_id=f"led_{rec_counter}",
                order_id=order_id,
                payment_id=payment_id,
                customer_id=f"cust_{rng.randint(100, 999)}",
                amount_paise=amt_paise,
                currency="INR",
                created_at=anom_date.strftime("%Y-%m-%d %H:%M:%S"),
                status="CAPTURED",
                narration=f"High Value PG Capture {customer} Order {order_id}",
                ground_truth_label=ReasonCode.PARTIAL_SETTLEMENT.value
            )
            ledger_records.append(ledger_item)
            
            fee_paise = int(round(amt_paise * CONTRACTUAL_MDR_RATE))
            tax_paise = int(round(fee_paise * GST_RATE_ON_MDR))
            net_paise = amt_paise - fee_paise - tax_paise - on_hold_paise
            
            settle_counter += 1
            utr = f"RBIP202608{rng.randint(10000000, 99999999)}"
            settlement_records.append(SettlementRecord(
                settlement_id=f"setl_RZP_{settle_counter}",
                utr=utr,
                settlement_date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                payment_ids=[payment_id],
                gross_amount_paise=amt_paise,
                fee_amount_paise=fee_paise,
                tax_amount_paise=tax_paise,
                net_amount_paise=net_paise,
                on_hold_amount_paise=on_hold_paise,
                status="PARTIALLY_SETTLED",
                narration=f"Partial Settlement with Risk Hold of ₹15,000 for {payment_id}"
            ))
            bank_counter += 1
            current_bank_balance_paise += net_paise
            bank_records.append(BankStatementRecord(
                bank_txn_id=f"bank_tx_{bank_counter}",
                utr=utr,
                date=(anom_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                credit_paise=net_paise,
                balance_paise=current_bank_balance_paise,
                narration=f"NEFT CR-RAZORPAY-PARTIAL-{utr}"
            ))

        elif anomaly_code == ReasonCode.UNRESOLVED_AMBIGUOUS:
            # Unidentified bank deposit (e.g. unknown customer wire, missing UTR)
            bank_counter += 1
            ambiguous_amt_paise = inr_to_paise(rng.randint(50, 200) * 100)
            current_bank_balance_paise += ambiguous_amt_paise
            bank_records.append(BankStatementRecord(
                bank_txn_id=f"bank_tx_{bank_counter}",
                utr="UTR_UNAVAILABLE",
                date=(anom_date + timedelta(days=3)).strftime("%Y-%m-%d"),
                credit_paise=ambiguous_amt_paise,
                balance_paise=current_bank_balance_paise,
                narration="UPI/9871239081/DIRECT-TRANSFER/MISC-NO-REF"
            ))

    # Shuffle for realistic asynchronous ingestion stream
    rng.shuffle(ledger_records)
    rng.shuffle(settlement_records)
    rng.shuffle(bank_records)
    
    return ledger_records, settlement_records, bank_records
