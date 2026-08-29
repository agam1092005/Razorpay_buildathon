import React, { useState, useEffect } from 'react';
import { 
  Layers, AlertTriangle, TrendingUp, Target, 
  Terminal, RefreshCw 
} from 'lucide-react';
import { 
  AppStateData, MatchRecord, ExceptionRecord 
} from './types/finance';
import { fetchAppState, generateBatch, executeRemediation } from './services/api';

import { Header } from './components/Header';
import { MetricsBanner } from './components/MetricsBanner';
import { ReconciliationMatrix } from './components/ReconciliationMatrix';
import { ExceptionTriageHub } from './components/ExceptionTriageHub';
import { CashForecasterView } from './components/CashForecasterView';
import { EvalHarnessView } from './components/EvalHarnessView';
import { SettlementQACopilot } from './components/SettlementQACopilot';
import { MatchDetailModal } from './components/MatchDetailModal';
import { BatchConfigModal } from './components/BatchConfigModal';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppStateData | null>(null);
  const [activeTab, setActiveTab] = useState<'RECON' | 'EXCEPTIONS' | 'CASH' | 'EVAL'>('RECON');
  
  // Theme state: dark or light
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('rz_theme') as 'dark' | 'light') || 'dark';
  });

  const [batchSize, setBatchSize] = useState<number>(60);
  const [anomalyRate, setAnomalyRate] = useState<number>(0.15);
  const [currentSeed, setCurrentSeed] = useState<number>(42);
  const [scenario, setScenario] = useState<string>('BASELINE');
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  // Modals & Drawers
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
  const [selectedException, setSelectedException] = useState<ExceptionRecord | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync theme with document element
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('rz_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    setIsReconciling(true);
    try {
      const data = await fetchAppState();
      setAppState(data);
      setCurrentSeed(data.seed);
    } catch (err) {
      console.error("Failed to load initial state, generating fresh batch...", err);
      handleRunRecon(60, 0.15, 42, 'BASELINE');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRunRecon = async (size: number, anomaly: number, seed: number, sc: string) => {
    setIsReconciling(true);
    setBatchSize(size);
    setAnomalyRate(anomaly);
    setCurrentSeed(seed);
    setScenario(sc);
    try {
      const data = await generateBatch({
        total_records: size,
        anomaly_rate: anomaly,
        seed,
        scenario: sc,
      });
      setAppState(data);
      showToast(`Batch of ${size} records processed in ${data.eval_metrics.throughput_ms}ms.`);
    } catch (err: any) {
      showToast(`Error running reconciliation: ${err.message || 'Server error'}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRemediate = async (exceptionId: string, actionType: string, notes?: string) => {
    try {
      const res = await executeRemediation(exceptionId, actionType, notes);
      showToast(res.message);
      const updated = await fetchAppState();
      setAppState(updated);
    } catch (err: any) {
      showToast(`Remediation failed: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] flex flex-col font-sans transition-colors">
      
      {/* Header with Theme Toggle */}
      <Header
        currentSeed={currentSeed}
        batchSize={batchSize}
        anomalyRate={anomalyRate}
        scenario={scenario}
        isReconciling={isReconciling}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRunRecon={handleRunRecon}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5">
        
        {/* KPI Strip */}
        <MetricsBanner
          metrics={appState?.eval_metrics || null}
          cashPosition={appState?.cash_position || null}
          totalSettlements={appState?.settlement_records.length || 0}
        />

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-[var(--border-card)] mb-5 pb-2">
          <div className="flex items-center gap-1.5 font-mono-finance">
            
            <button
              onClick={() => setActiveTab('RECON')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                activeTab === 'RECON'
                  ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>3-Way Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('EXCEPTIONS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                activeTab === 'EXCEPTIONS'
                  ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Exceptions</span>
              {appState?.exceptions && appState.exceptions.length > 0 && (
                <span className="px-1 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] text-[10px]">
                  {appState.exceptions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('CASH')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                activeTab === 'CASH'
                  ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Cash & Float</span>
            </button>

            <button
              onClick={() => setActiveTab('EVAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                activeTab === 'EVAL'
                  ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Eval Harness</span>
            </button>

          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs font-mono-finance text-[var(--text-muted)]">
            <span>Deterministic Verified</span>
          </div>
        </div>

        {/* Dynamic Views */}
        {appState ? (
          <>
            {activeTab === 'RECON' && (
              <ReconciliationMatrix
                ledgerRecords={appState.ledger_records}
                settlementRecords={appState.settlement_records}
                bankRecords={appState.bank_records}
                matches={appState.matches}
                exceptions={appState.exceptions}
                onSelectMatch={(m) => setSelectedMatch(m)}
                onSelectException={(exc) => {
                  setSelectedException(exc);
                  setActiveTab('EXCEPTIONS');
                }}
              />
            )}

            {activeTab === 'EXCEPTIONS' && (
              <ExceptionTriageHub
                exceptions={appState.exceptions}
                onRemediate={handleRemediate}
              />
            )}

            {activeTab === 'CASH' && (
              <CashForecasterView
                cashPosition={appState.cash_position}
                scenario={scenario}
                onScenarioChange={(sc) => handleRunRecon(batchSize, anomalyRate, currentSeed, sc)}
              />
            )}

            {activeTab === 'EVAL' && (
              <EvalHarnessView
                metrics={appState.eval_metrics}
                currentSeed={currentSeed}
                onShuffleSeed={() => handleRunRecon(batchSize, anomalyRate, Math.floor(Math.random() * 9000) + 1000, scenario)}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] font-mono-finance text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-sub)] mb-2" />
            <p>Loading reconciliation state...</p>
          </div>
        )}

      </main>

      {/* Floating Settlement Q&A Trigger */}
      {!isCopilotOpen && (
        <button
          onClick={() => setIsCopilotOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[var(--pill-active-bg)] hover:opacity-90 text-[var(--pill-active-text)] font-semibold text-xs shadow-lg transition-all"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Settlement Q&A</span>
        </button>
      )}

      {/* Modals & Drawers */}
      <MatchDetailModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />

      <BatchConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        currentSize={batchSize}
        currentAnomalyRate={anomalyRate}
        currentSeed={currentSeed}
        currentScenario={scenario}
        onApply={(s, a, seed, sc) => handleRunRecon(s, a, seed, sc)}
      />

      <SettlementQACopilot
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        samplePaymentId={appState?.exceptions[0]?.related_payment_id || 'pay_anom_1001'}
        sampleSettlementId={appState?.settlement_records[0]?.settlement_id || 'setl_RZP_501'}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-main)] text-xs px-3.5 py-2 rounded-lg shadow-xl font-mono-finance">
          {toastMessage}
        </div>
      )}

    </div>
  );
};

export default App;
