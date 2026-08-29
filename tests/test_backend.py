import pytest
from backend.synthetic_generator import generate_synthetic_batch
from backend.reconciliation_pipeline import ReconciliationPipeline
from backend.eval_harness import EvaluationHarness
from backend.cash_forecaster import CashForecaster
from backend.qa_tools import SettlementQAToolkit
from backend.models import ReasonCode, MatchTier, paise_to_inr, inr_to_paise

def test_synthetic_generator_size_and_types():
    """Verify generator produces valid multi-source datasets with 50+ records."""
    ledger, settlements, bank = generate_synthetic_batch(total_ledger_records=60, anomaly_rate=0.15, seed=42)
    
    assert len(ledger) >= 60
    assert len(settlements) > 0
    assert len(bank) > 0
    
    # Verify currency is stored in paise (integer)
    for r in ledger:
        assert isinstance(r.amount_paise, int)
        assert r.amount_paise > 0
    
    for s in settlements:
        assert isinstance(s.gross_amount_paise, int)
        assert isinstance(s.fee_amount_paise, int)
        assert isinstance(s.net_amount_paise, int)

def test_reconciliation_pipeline_and_netting():
    """Verify 4-tier pipeline correctly verifies N:1 batch netting and confidence gates."""
    ledger, settlements, bank = generate_synthetic_batch(total_ledger_records=70, anomaly_rate=0.15, seed=101)
    pipeline = ReconciliationPipeline()
    matches, exceptions, elapsed_ms = pipeline.run(ledger, settlements, bank)
    
    assert len(matches) > 0
    assert len(exceptions) > 0
    assert elapsed_ms < 500  # High throughput (<500ms)
    
    # Check that N:1 batch netting matches have valid audit proofs
    n1_matches = [m for m in matches if m.match_tier == MatchTier.TIER_N1_BATCH_NETTING]
    assert len(n1_matches) > 0
    for m in n1_matches:
        assert len(m.ledger_record_ids) > 1
        assert "Net Settlement verified" in m.audit_proof
        assert m.confidence >= 0.95

def test_evaluation_harness_metrics():
    """Verify evaluation harness produces precision, recall, and F1 metrics."""
    ledger, settlements, bank = generate_synthetic_batch(total_ledger_records=65, anomaly_rate=0.15, seed=42)
    pipeline = ReconciliationPipeline()
    matches, exceptions, elapsed_ms = pipeline.run(ledger, settlements, bank)
    
    metrics = EvaluationHarness.evaluate(ledger, settlements, bank, matches, exceptions, elapsed_ms)
    
    assert metrics.total_records == len(ledger)
    assert metrics.match_rate_pct > 70.0
    assert metrics.overall_accuracy_pct > 80.0
    assert "CLEAN_MATCH" in metrics.per_reason_metrics
    assert metrics.per_reason_metrics["CLEAN_MATCH"].precision > 0.85

def test_cash_forecaster():
    """Verify cash position breakdown and 30-day forward forecast."""
    ledger, settlements, bank = generate_synthetic_batch(total_ledger_records=50, anomaly_rate=0.15, seed=42)
    pipeline = ReconciliationPipeline()
    matches, exceptions, elapsed_ms = pipeline.run(ledger, settlements, bank)
    
    cash_snapshot = CashForecaster.calculate_position(ledger, settlements, bank, matches, exceptions)
    
    assert cash_snapshot.realized_cash_paise > 0
    assert cash_snapshot.in_transit_float_paise >= 0
    assert len(cash_snapshot.forecast_30d) == 31

def test_qa_toolkit():
    """Verify deterministic parameterized tools execute without errors."""
    ledger, settlements, bank = generate_synthetic_batch(total_ledger_records=50, anomaly_rate=0.15, seed=42)
    pipeline = ReconciliationPipeline()
    matches, exceptions, elapsed_ms = pipeline.run(ledger, settlements, bank)
    
    toolkit = SettlementQAToolkit(ledger, settlements, bank, matches, exceptions)
    
    summary = toolkit.get_batch_summary_metrics()
    assert "match_rate_pct" in summary
    
    # Test fee inquiry
    settle_id = settlements[0].settlement_id
    fee_report = toolkit.explain_fee_variance(settle_id)
    assert "effective_mdr_rate" in fee_report
    
    # Test natural query
    ans = toolkit.answer_query("Why did settlement have fee overcharge?")
    assert "tool_called" in ans
    assert ans["tool_called"] == "explain_fee_variance"
