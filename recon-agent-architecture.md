# Recon-Q&A Agent — Production Architecture (v2)
### Razorpay AI Buildathon — Track 04: AI Finance Controller

---

## 1. Scope Decision

Combine three of the track's example directions into one coherent product:

- **Multi-source reconciliation** (the core engine, including N:1 settlement netting)
- **Cash position / running the books** (explicitly named in the track title)
- **Settlement Q&A agent** (the interface judges interact with)

Frame the whole thing around Razorpay's actual settlement/payout vocabulary — `payment_id`, `settlement_id`, `utr`, `order_id`, `refund_id`, `mdr_fee`, `tax`, `on_hold_amount`.

**One-line pitch:** *"An agent that reconciles Razorpay settlements against internal ledgers — including netted batch settlements with fees and GST — auto-resolves what it's confident about, tracks the live cash position, and lets you interrogate every exception in plain English through gated, deterministic tools."*

---

## 2. System Architecture

```
                         ┌─────────────────────────┐
                         │   Data Generator (offline)│
                         │  ledger.csv, settlement.csv │
                         │  + labeled mutations         │
                         │  + N:1 netted settlement rows│
                         └──────────────┬─────────────┘
                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│              FastAPI Ingestion (Paisa/Decimal schema,               │
│              content-hash dedup, Pydantic validation)                │
└──────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Normalization Node (LLM-assisted)                 │
│  Standardizes narrations only. Never touches numeric fields.         │
└──────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│              LangGraph Reconciliation Pipeline                       │
│                                                                        │
│  [Tier 0: Exact Match] amount + date + reference                     │
│         │ no match                                                    │
│         ▼                                                             │
│  [Tier 1: Fuzzy Match] pg_trgm first pass → pgvector semantic          │
│                          fallback (both inside Postgres, no             │
│                          separate embedding service)                    │
│         │ no match                                                    │
│         ▼                                                             │
│  [Tier N:1: Batch Settlement Netting]                                 │
│    Group by settlement reference list where available; VERIFY          │
│    (not discover) that:                                                │
│    Settlement Net = Σ(Gross Payments) − Σ(Refunds) − MDR Fees − GST    │
│         │                                                             │
│         ▼                                                             │
│  [Confidence Gate]                                                    │
│    ≥ 0.95 → auto-confirm, logged with rule/agent ID                    │
│    < 0.95 → routed to Exception Table                                  │
│         │                                                             │
│         ▼                                                             │
│  [Reason Classifier (LLM)] tags exception:                            │
│    DATE_MISMATCH | AMOUNT_MISMATCH | DUPLICATE_ENTRY |                 │
│    MISSING_COUNTERPART | CURRENCY_MISMATCH |                           │
│    FEE_TAX_DISCREPANCY | PARTIAL_SETTLEMENT | UNRESOLVED_AMBIGUOUS     │
└──────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│           PostgreSQL — Immutable Audit Store + Cash Position          │
│  matches, exceptions, reason codes, confidence, matched_by,           │
│  Cash Position Breakdown computed per run:                            │
│    Realized Cash   = Σ confirmed settlements                          │
│    In-Transit Float = ledger entries awaiting settlement (T+1/T+2)     │
│    At-Risk Float    = disputed / chargeback / on_hold_amount records   │
│    Fee Leakage      = Σ MDR + GST deducted vs. contractual expectation │
│  All currency stored as NUMERIC(18,4) in paisa — never FLOAT/DOUBLE.   │
└──────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│      Settlement Q&A Agent — Parameterized Tool Layer (not raw SQL)    │
│  get_exception_by_payment_id(payment_id)                              │
│  list_exceptions_by_reason(reason_code, limit)                        │
│  get_batch_summary_metrics(batch_id)                                  │
│  explain_fee_variance(settlement_id)                                  │
│  propose_remediation(exception_id) → drafts adjusting entry,           │
│    NEVER auto-posts — always returns a confirm-to-execute action       │
│  Fallback: run_safe_readonly_query(sql) — read-only DB role,           │
│    2s statement timeout, defense-in-depth under the tool layer         │
└──────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│              React/Tailwind Dashboard                                │
│  Match rate | Cash position breakdown | Precision/recall vs.          │
│  ground truth | Exception list by reason code | Chat interface        │
│  with 1-click "Execute proposed adjustment" (human-in-the-loop)       │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model & Reason Code Taxonomy

**Core tables:**
- `ledger_records` — internal AR/AP entries (NUMERIC(18,4), paisa)
- `settlement_records` — Razorpay-style settlement/payout entries, may reference multiple `payment_id`s for N:1 batches
- `matches` — confirmed pairs/groups, confidence, matched_by, timestamp
- `exceptions` — unresolved records, reason_code, confidence, resolution_status, proposed_remediation
- `audit_log` — append-only event stream (every action, no deletes/updates)
- `cash_position_snapshots` — realized cash, in-transit float, at-risk float, fee leakage, per run

**Reason codes** (fixed enum — this is what makes the exception list scoreable, not free text):
```
DATE_MISMATCH | AMOUNT_MISMATCH | DUPLICATE_ENTRY | MISSING_COUNTERPART
CURRENCY_MISMATCH | FEE_TAX_DISCREPANCY | PARTIAL_SETTLEMENT | UNRESOLVED_AMBIGUOUS
```

---

## 4. Ground Truth & Evaluation Harness

The brief says: *"measured accuracy... one cherry-picked match proves nothing."* You need labels to prove anything.

1. Synthetic generator starts from matched pairs, then deliberately corrupts a known subset with a *labeled* discrepancy type — including at least one N:1 netted settlement batch with known fee/GST deductions.
2. Run the pipeline. Compare output against injected ground truth.
3. Report **precision, recall, F1 per reason code**, not just an aggregate match rate.
4. Show this live on a re-shuffled seed the judges didn't see beforehand.

---

## 5. Tech Stack

| Component | Technology | Why |
|---|---|---|
| Backend API | FastAPI + Pydantic | Strict schema validation at every ingestion boundary |
| Database | PostgreSQL | Relational integrity, append-only audit table, home for pg_trgm/pgvector |
| Fuzzy matching | `pg_trgm` (first pass) + `pgvector` (semantic fallback) — both inside Postgres | No separate embedding microservice; trigram catches typos, pgvector catches semantic differences trigram misses |
| Orchestration | LangGraph | State-machine control, prevents free-form agent drift on money logic |
| Q&A Agent | LLM + parameterized tool functions over Postgres | Deterministic, no SQL-hallucination risk during a live demo; read-only role + statement timeout as defense-in-depth fallback only |
| Frontend | React + Tailwind + shadcn/ui | Dashboard: match rate, cash position, exceptions, chat |
| Deployment | Docker Compose (one command) + hosted demo (Railway/Render + Vercel) | Judges click a link instead of trusting your localhost |
| Testing | pytest + fixed-seed labeled dataset | Reproducible accuracy numbers you can quote in the pitch |
| Currency | `NUMERIC(18,4)` in paisa, never `FLOAT`/`DOUBLE` | Eliminates floating-point precision errors in money math |

---

## 6. Security / Production-Readiness Signals

- API key auth on ingestion endpoints
- Idempotent ingestion (content-hash dedup)
- Read-only DB role + 2s statement timeout for the Q&A agent's SQL fallback tool
- Remediation actions are proposed, never auto-executed — explicit human confirm-to-execute
- No real card/PII data — mirror Razorpay's test-mode conventions
- Structured logging per pipeline stage for end-to-end traceability

---

## 7. Implementation Priority (if time-constrained)

1. Cash position summary node — cheap, directly answers the track title
2. Paisa/NUMERIC currency handling throughout — cheap, high credibility
3. Parameterized tool layer for the Q&A agent — replaces riskier raw SQL approach
4. pg_trgm fuzzy matching — low effort, inside Postgres already
5. N:1 batch settlement netting — verify against reference list, don't discover groupings from scratch
6. Remediation action proposals with confirm-to-execute — completes "closes one finance-ops loop"
7. pgvector semantic fallback — cut first if time is tight; pg_trgm alone may suffice for synthetic data

---

## 8. 5-Minute Pitch Structure

1. **0:00–0:45** — Problem framing: reconciliation and cash visibility are still manual; verification, not generation, is the bottleneck.
2. **0:45–2:00** — Live demo: ingest a fresh batch (including an N:1 netted settlement), show throughput and match rate live.
3. **2:00–2:45** — Cash position dashboard: realized cash, in-transit float, at-risk float, fee leakage.
4. **2:45–3:30** — Exception list + confidence gating: a low-confidence match correctly *not* auto-confirmed, with its reason code.
5. **3:30–4:15** — Q&A agent: ask "why didn't payment X reconcile?" live, show a parameterized tool call — not raw SQL guessing.
6. **4:15–5:00** — Accuracy claim: precision/recall against labeled ground truth, explicitly state "this isn't cherry-picked, here's the eval harness."
