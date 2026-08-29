from __future__ import annotations
from typing import List, Dict, Any
from backend.models import (
    LedgerRecord, SettlementRecord, BankStatementRecord,
    MatchRecord, ExceptionRecord, ReasonCode,
    EvaluationMetrics, ClassificationMetric
)

class EvaluationHarness:
    """
    Evaluation & Benchmark Engine:
    Compares the reconciliation pipeline's deterministic & classified outputs
    against deliberately injected ground-truth labels.
    
    Reports:
    - Precision, Recall, F1 score per Reason Code
    - Confusion Matrix
    - Auto-Match Rate % & Overall Accuracy %
    """

    @staticmethod
    def evaluate(
        ledger_records: List[LedgerRecord],
        settlement_records: List[SettlementRecord],
        bank_records: List[BankStatementRecord],
        matches: List[MatchRecord],
        exceptions: List[ExceptionRecord],
        throughput_ms: float
    ) -> EvaluationMetrics:
        
        # Ground Truth Label Tracker
        # Map: entity_id -> true_label ("CLEAN_MATCH" or ReasonCode)
        gt_labels: Dict[str, str] = {}
        for r in ledger_records:
            gt_labels[r.record_id] = r.ground_truth_label or "CLEAN_MATCH"
            
        # Collect predictions
        # Records in matches are predicted as "CLEAN_MATCH"
        pred_labels: Dict[str, str] = {}
        for m in matches:
            for led_id in m.ledger_record_ids:
                pred_labels[led_id] = "CLEAN_MATCH"
                
        # Records in exceptions are predicted with their classified reason_code
        for exc in exceptions:
            if exc.source_record_id in gt_labels:
                pred_labels[exc.source_record_id] = exc.reason_code.value
            elif exc.related_payment_id:
                # Find matching ledger records by payment_id
                for r in ledger_records:
                    if r.payment_id == exc.related_payment_id:
                        pred_labels[r.record_id] = exc.reason_code.value

        all_keys = list(gt_labels.keys())
        total_eval_count = len(all_keys)
        
        # Reason codes + CLEAN_MATCH
        all_classes = ["CLEAN_MATCH"] + [rc.value for rc in ReasonCode]
        
        # Confusion matrix: [True_Label][Pred_Label] -> Count
        confusion_matrix: Dict[str, Dict[str, int]] = {
            c: {p: 0 for p in all_classes} for c in all_classes
        }
        
        correct_count = 0
        for k in all_keys:
            true_cls = gt_labels.get(k, "CLEAN_MATCH")
            pred_cls = pred_labels.get(k, "UNRESOLVED_AMBIGUOUS")
            if pred_cls not in confusion_matrix.get(true_cls, {}):
                confusion_matrix[true_cls][pred_cls] = 0
            confusion_matrix[true_cls][pred_cls] += 1
            if true_cls == pred_cls:
                correct_count += 1

        overall_accuracy_pct = round((correct_count / max(1, total_eval_count)) * 100.0, 2)
        
        # Compute Precision, Recall, F1 per class
        per_reason_metrics: Dict[str, ClassificationMetric] = {}
        
        for cls_name in all_classes:
            tp = confusion_matrix[cls_name].get(cls_name, 0)
            fn = sum(confusion_matrix[cls_name].values()) - tp
            fp = sum(confusion_matrix[other].get(cls_name, 0) for other in all_classes if other != cls_name)
            
            support = tp + fn
            if support == 0 and fp == 0:
                continue
                
            precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 1.0
            recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 1.0
            f1 = round(2 * (precision * recall) / (precision + recall), 4) if (precision + recall) > 0 else 1.0
            
            per_reason_metrics[cls_name] = ClassificationMetric(
                precision=precision,
                recall=recall,
                f1_score=f1,
                support=support
            )

        auto_matched_ledger_count = sum(len(m.ledger_record_ids) for m in matches)
        match_rate_pct = round((auto_matched_ledger_count / max(1, len(ledger_records))) * 100.0, 2)

        return EvaluationMetrics(
            total_records=len(ledger_records),
            auto_matched_count=auto_matched_ledger_count,
            match_rate_pct=match_rate_pct,
            exception_count=len(exceptions),
            overall_accuracy_pct=overall_accuracy_pct,
            throughput_ms=throughput_ms,
            per_reason_metrics=per_reason_metrics,
            confusion_matrix=confusion_matrix
        )
