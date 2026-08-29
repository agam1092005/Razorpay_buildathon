from __future__ import annotations
import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.models import (
    LedgerRecord, SettlementRecord, BankStatementRecord,
    MatchRecord, ExceptionRecord, CashPositionSnapshot,
    EvaluationMetrics, ResolutionStatus
)
from backend.synthetic_generator import generate_synthetic_batch
from backend.reconciliation_pipeline import ReconciliationPipeline
from backend.eval_harness import EvaluationHarness
from backend.cash_forecaster import CashForecaster
from backend.qa_tools import SettlementQAToolkit

app = FastAPI(
    title="Razorpay Recon-Q&A Agent — AI Finance Controller API",
    version="2.0.0",
    description="Deterministic multi-source reconciliation, N:1 batch netting, cash position tracking, and settlement Q&A tool layer."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory application state
class AppState:
    def __init__(self):
        self.pipeline = ReconciliationPipeline()
        self.ledger_records: List[LedgerRecord] = []
        self.settlement_records: List[SettlementRecord] = []
        self.bank_records: List[BankStatementRecord] = []
        self.matches: List[MatchRecord] = []
        self.exceptions: List[ExceptionRecord] = []
        self.cash_position: Optional[CashPositionSnapshot] = None
        self.eval_metrics: Optional[EvaluationMetrics] = None
        self.toolkit: Optional[SettlementQAToolkit] = None
        self.audit_log: List[Dict[str, Any]] = []
        self.current_seed: int = 42
        
        # Initialize default 60-record dataset
        self.refresh_batch(total_records=60, anomaly_rate=0.15, seed=42)

    def refresh_batch(self, total_records: int = 60, anomaly_rate: float = 0.15, seed: int = 42, scenario: str = "BASELINE"):
        self.current_seed = seed
        self.ledger_records, self.settlement_records, self.bank_records = generate_synthetic_batch(
            total_ledger_records=total_records,
            anomaly_rate=anomaly_rate,
            seed=seed
        )
        
        self.matches, self.exceptions, throughput_ms = self.pipeline.run(
            self.ledger_records,
            self.settlement_records,
            self.bank_records
        )
        
        self.eval_metrics = EvaluationHarness.evaluate(
            self.ledger_records,
            self.settlement_records,
            self.bank_records,
            self.matches,
            self.exceptions,
            throughput_ms
        )
        
        self.cash_position = CashForecaster.calculate_position(
            self.ledger_records,
            self.settlement_records,
            self.bank_records,
            self.matches,
            self.exceptions,
            scenario=scenario
        )
        
        self.toolkit = SettlementQAToolkit(
            self.ledger_records,
            self.settlement_records,
            self.bank_records,
            self.matches,
            self.exceptions
        )
        
        self.audit_log.append({
            "action": "BATCH_INITIALIZED",
            "total_records": total_records,
            "seed": seed,
            "match_rate": self.eval_metrics.match_rate_pct,
            "throughput_ms": throughput_ms
        })

state = AppState()

# Request schemas
class GenerateBatchRequest(BaseModel):
    total_records: int = Field(default=60, ge=10, le=500)
    anomaly_rate: float = Field(default=0.15, ge=0.0, le=0.5)
    seed: int = Field(default=42)
    scenario: str = Field(default="BASELINE")

class ChatQARequest(BaseModel):
    query: str

class RemediateRequest(BaseModel):
    exception_id: str
    action_type: str
    notes: Optional[str] = None

@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "Recon-Q&A Controller API", "version": "2.0.0"}

@app.get("/api/v1/state")
def get_state():
    return {
        "ledger_records": [r.model_dump() for r in state.ledger_records],
        "settlement_records": [s.model_dump() for s in state.settlement_records],
        "bank_records": [b.model_dump() for b in state.bank_records],
        "matches": [m.model_dump() for m in state.matches],
        "exceptions": [e.model_dump() for e in state.exceptions],
        "cash_position": state.cash_position.model_dump() if state.cash_position else None,
        "eval_metrics": state.eval_metrics.model_dump() if state.eval_metrics else None,
        "audit_log": state.audit_log,
        "seed": state.current_seed
    }

@app.post("/api/v1/generate-batch")
def generate_batch(req: GenerateBatchRequest):
    state.refresh_batch(
        total_records=req.total_records,
        anomaly_rate=req.anomaly_rate,
        seed=req.seed,
        scenario=req.scenario
    )
    return get_state()

@app.post("/api/v1/chat-qa")
def chat_qa(req: ChatQARequest):
    if not state.toolkit:
        raise HTTPException(status_code=500, detail="Toolkit not initialized")
    result = state.toolkit.answer_query(req.query)
    return result

@app.post("/api/v1/remediate")
def remediate_exception(req: RemediateRequest):
    exc = next((e for e in state.exceptions if e.exception_id == req.exception_id), None)
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")
        
    exc.resolution_status = ResolutionStatus.RESOLVED
    state.audit_log.append({
        "action": "EXCEPTION_REMEDIATED",
        "exception_id": exc.exception_id,
        "action_type": req.action_type,
        "variance_resolved": exc.variance_paise,
        "notes": req.notes
    })
    
    # Recalculate cash position
    state.cash_position = CashForecaster.calculate_position(
        state.ledger_records,
        state.settlement_records,
        state.bank_records,
        state.matches,
        state.exceptions
    )
    
    return {
        "status": "SUCCESS",
        "message": f"Remediation '{exc.proposed_remediation.title}' executed successfully. Audit entry logged.",
        "exception_id": exc.exception_id,
        "resolution_status": exc.resolution_status.value
    }
