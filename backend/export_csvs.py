# Multi-source offline dataset exporter
import csv
import os
from backend.synthetic_generator import generate_synthetic_batch
from backend.models import paise_to_inr

def export_csvs(seed=42, total_records=60):
    os.makedirs("data", exist_ok=True)
    ledger, settlements, bank = generate_synthetic_batch(total_ledger_records=total_records, anomaly_rate=0.15, seed=seed)
    
    # 1. Export ledger.csv
    with open("data/ledger.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["record_id", "order_id", "payment_id", "customer_id", "amount_inr", "amount_paise", "currency", "created_at", "status", "narration", "ground_truth_label"])
        for r in ledger:
            writer.writerow([r.record_id, r.order_id, r.payment_id, r.customer_id, paise_to_inr(r.amount_paise), r.amount_paise, r.currency, r.created_at, r.status, r.narration, r.ground_truth_label or "CLEAN"])

    # 2. Export settlement.csv
    with open("data/settlement.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["settlement_id", "utr", "settlement_date", "payment_ids_count", "payment_ids", "gross_amount_inr", "fee_amount_inr", "tax_amount_inr", "net_amount_inr", "on_hold_amount_inr", "status", "narration"])
        for s in settlements:
            writer.writerow([s.settlement_id, s.utr, s.settlement_date, len(s.payment_ids), ";".join(s.payment_ids), paise_to_inr(s.gross_amount_paise), paise_to_inr(s.fee_amount_paise), paise_to_inr(s.tax_amount_paise), paise_to_inr(s.net_amount_paise), paise_to_inr(s.on_hold_amount_paise), s.status, s.narration])

    # 3. Export bank_statement.csv
    with open("data/bank_statement.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["bank_txn_id", "utr", "date", "credit_inr", "debit_inr", "balance_inr", "narration"])
        for b in bank:
            writer.writerow([b.bank_txn_id, b.utr, b.date, paise_to_inr(b.credit_paise), paise_to_inr(b.debit_paise), paise_to_inr(b.balance_paise), b.narration])

    print("Sample datasets successfully exported to data/ directory.")

if __name__ == "__main__":
    export_csvs()
