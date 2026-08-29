import { AppStateData } from '../types/finance';

const API_BASE = '/api/v1';

export async function fetchAppState(): Promise<AppStateData> {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) {
    throw new Error(`Failed to fetch state: ${res.statusText}`);
  }
  return res.json();
}

export async function generateBatch(params: {
  total_records: number;
  anomaly_rate: number;
  seed: number;
  scenario?: string;
}): Promise<AppStateData> {
  const res = await fetch(`${API_BASE}/generate-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total_records: params.total_records,
      anomaly_rate: params.anomaly_rate,
      seed: params.seed,
      scenario: params.scenario || 'BASELINE',
    }),
  });
  if (!res.ok) {
    throw new Error(`Batch generation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function askChatQA(query: string): Promise<{
  tool_called: string;
  parameters: Record<string, any>;
  tool_output: any;
  answer: string;
}> {
  const res = await fetch(`${API_BASE}/chat-qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`QA agent failed: ${res.statusText}`);
  }
  return res.json();
}

export async function executeRemediation(
  exception_id: string,
  action_type: string,
  notes?: string
): Promise<{ status: string; message: string; exception_id: string }> {
  const res = await fetch(`${API_BASE}/remediate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exception_id, action_type, notes }),
  });
  if (!res.ok) {
    throw new Error(`Remediation failed: ${res.statusText}`);
  }
  return res.json();
}
