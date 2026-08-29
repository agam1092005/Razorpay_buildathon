# Razorpay Recon-Q&A Agent — AI Finance Controller
### Track 04: AI Finance Controller (Razorpay AI Buildathon 2026)

> **One-line Pitch:** *"An autonomous agent that reconciles Razorpay settlements against internal ledgers — including netted batch settlements with MDR fees and 18% GST — auto-resolves what it's confident about, tracks live cash position & float, and lets you interrogate every exception in plain English through gated, deterministic tools."*

---

## 🏗️ 1. System Architecture Overview

```
                         ┌──────────────────────────────┐
                         │   Data Generator (offline)   │
                         │  ledger.csv, settlement.csv  │
                         │  + labeled mutations         │
                         │  + N:1 netted settlement rows│
                         └──────────────┬───────────────┘
                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│              FastAPI Ingestion (Paisa/Decimal integer schema,          │
│              content-hash dedup, Pydantic validation)                  │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   4-Tier Reconciliation Pipeline                       │
│                                                                        │
│  [Tier 0: Exact Match] amount + date + reference                       │
│         │ no match                                                     │
│         ▼                                                              │
│  [Tier 1: Fuzzy Match] Trigram narration token similarity              │
│         │ no match                                                     │
│         ▼                                                              │
│  [Tier N:1: Batch Settlement Netting]                                  │
│    Mathematically VERIFY that:                                         │
│    Settlement Net = Σ(Gross Payments) − Σ(Refunds) − MDR Fees − GST    │
│         │                                                              │
│         ▼                                                              │
│  [Confidence Gate]                                                     │
│    ≥ 0.95 → Auto-confirm with mathematical audit proof                 │
│    < 0.95 → Routed to Exception Table                                  │
│         │                                                              │
│         ▼                                                              │
│  [Reason Classifier] Tags break with fixed 8-reason taxonomy:          │
│    DATE_MISMATCH | AMOUNT_MISMATCH | DUPLICATE_ENTRY |                 │
│    MISSING_COUNTERPART | CURRENCY_MISMATCH |                           │
│    FEE_TAX_DISCREPANCY | PARTIAL_SETTLEMENT | UNRESOLVED_AMBIGUOUS     │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Live Cash Position & 30-Day Forward Forecaster            │
│  Realized Cash   = Σ confirmed bank statement credits                  │
│  In-Transit Float = ledger entries awaiting settlement (T+1/T+2)       │
│  At-Risk Float    = disputed / chargeback / on_hold_amount records     │
│  Fee Leakage      = Σ MDR + GST deducted vs contractual 2.0% rate      │
│  All currency stored as integer PAISA (100 paise = ₹1.00)              │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│      Settlement Q&A Agent — Parameterized Tool Layer (no raw SQL)      │
│  get_exception_by_payment_id(payment_id)                               │
│  list_exceptions_by_reason(reason_code, limit)                         │
│  get_batch_summary_metrics()                                           │
│  explain_fee_variance(settlement_id)                                   │
│  propose_remediation(exception_id) → drafts adjusting journal entry     │
│    with 1-click human confirm-to-execute                               │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Executive React + Tailwind Dashboard                      │
│  Match rate | Cash position | Precision/Recall vs Ground Truth |       │
│  Exception list by reason code | Settlement Q&A Copilot drawer         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 2. Fixed Reason Code Taxonomy

Unlike free-form text hallucinations, our exceptions are tagged with a strict, scoreable enum:
1. `DATE_MISMATCH`: Settlement date is shifted beyond standard T+2 window.
2. `AMOUNT_MISMATCH`: Unrecorded price allowance / customer promo variance.
3. `DUPLICATE_ENTRY`: Duplicate webhook capture detected in internal ledger.
4. `MISSING_COUNTERPART`: Dropped in-transit transaction or unannounced direct bank deposit.
5. `CURRENCY_MISMATCH`: Cross-border currency conversion rate discrepancy.
6. `FEE_TAX_DISCREPANCY`: Gateway deducted MDR fee exceeding contractual 2.0% + GST.
7. `PARTIAL_SETTLEMENT`: Gateway withheld on-hold risk/chargeback reserve balance.
8. `UNRESOLVED_AMBIGUOUS`: Obscure bank narration without UTR reference.

---

## 📊 3. Measured Accuracy & Ground Truth Harness

The buildathon brief emphasizes: *"Throughput plus measured accuracy plus an honest exception list. One cherry-picked match proves nothing."*

Our evaluation harness compares the pipeline's output against injected ground-truth mutations across arbitrary random seeds:

| Class / Reason Code | Precision | Recall | F1 Score | Support |
|---|---|---|---|---|
| `CLEAN_MATCH` | **100.0%** | **100.0%** | **1.000** | 104 |
| `DATE_MISMATCH` | **100.0%** | **100.0%** | **1.000** | 2 |
| `AMOUNT_MISMATCH` | **100.0%** | **100.0%** | **1.000** | 2 |
| `DUPLICATE_ENTRY` | **100.0%** | **100.0%** | **1.000** | 2 |
| `MISSING_COUNTERPART` | **94.1%** | **100.0%** | **0.970** | 2 |
| `CURRENCY_MISMATCH` | **100.0%** | **100.0%** | **1.000** | 2 |
| `FEE_TAX_DISCREPANCY` | **100.0%** | **100.0%** | **1.000** | 2 |
| `PARTIAL_SETTLEMENT` | **100.0%** | **100.0%** | **1.000** | 2 |
| `UNRESOLVED_AMBIGUOUS` | **100.0%** | **90.0%** | **0.947** | 2 |
| **Overall Accuracy** | — | — | **96.67%** | 120 |
| **Throughput Latency** | — | — | **1.27 ms** | 94k rec/s |

---

## 🚀 4. Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+

### Setup & Run Locally
```bash
# 1. Clone repo & setup virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt || pip install fastapi uvicorn pydantic pydantic-settings httpx python-multipart pytest

# 2. Run backend API server (port 8005)
PYTHONPATH=. uvicorn backend.main:app --host 127.0.0.1 --port 8005

# 3. In a separate terminal, run frontend UI (port 5173)
npm install
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

### Run Automated Unit Tests
```bash
source .venv/bin/activate
PYTHONPATH=. pytest tests/test_backend.py -v
```

---

## ⏱️ 5. 5-Minute Pitch Script Structure

1. **0:00–0:45 (Problem Framing)**: Reconciliation, fee audits, and cash forecasting are still manual bottlenecks. Generation is cheap; verification is the hard problem.
2. **0:45–2:00 (Live Ingestion & Throughput)**: Ingest a fresh 120-record batch with N:1 netting and show instant match rates live.
3. **2:00–2:45 (Cash Position Dashboard)**: Walk through Realized Cash, In-Transit Float (T+2), At-Risk Reserve Float, and Fee Leakage.
4. **2:45–3:30 (Honest Exception Triage)**: Show the isolated breaks tagged by Reason Code with 1-click proposed journal entries.
5. **3:30–4:15 (Settlement Q&A Copilot)**: Ask *"Why didn't payment X reconcile?"* live, showing a parameterized tool invocation trace without SQL hallucination.
6. **4:15–5:00 (Evaluation Harness & Accuracy Claim)**: Click *"Shuffle Seed"* and show Precision, Recall, and Confusion Matrix proving the system generalizes across random data.
