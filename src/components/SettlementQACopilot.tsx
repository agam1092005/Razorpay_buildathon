import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askChatQA } from '../services/api';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  toolCalled?: string;
  parameters?: Record<string, any>;
  toolOutput?: any;
  timestamp: string;
}

interface SettlementQACopilotProps {
  isOpen: boolean;
  onClose: () => void;
  samplePaymentId?: string;
  sampleSettlementId?: string;
}

export const SettlementQACopilot: React.FC<SettlementQACopilotProps> = ({
  isOpen,
  onClose,
  samplePaymentId = 'pay_anom_1001',
  sampleSettlementId = 'setl_RZP_501',
}) => {
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "I am your **AI Finance Controller**. I use gated deterministic tools over your settlement and ledger tables. Ask about specific payment IDs, fee overcharges, cash positions, or exception causes.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (userPrompt?: string) => {
    const promptToSend = (userPrompt || query).trim();
    if (!promptToSend || isLoading) return;

    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await askChatQA(promptToSend);
      const agentMsg: Message = {
        id: `msg_agent_${Date.now()}`,
        sender: 'agent',
        text: response.answer,
        toolCalled: response.tool_called,
        parameters: response.parameters,
        toolOutput: response.tool_output,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: `msg_err_${Date.now()}`,
        sender: 'agent',
        text: `Error contacting agent tool layer: ${err.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-[var(--bg-card)] border-l border-[var(--border-card)] shadow-2xl z-50 flex flex-col justify-between transition-colors">
      
      {/* Header */}
      <div className="p-3.5 border-b border-[var(--border-card)] flex items-center justify-between bg-[var(--bg-header)]">
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-emphasis)] tracking-tight flex items-center gap-2">
            <span>Settlement Q&A Copilot</span>
            <span className="px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--text-sub)] border border-[var(--border-card)] text-[10px] font-mono-finance">
              Gated Tools
            </span>
          </h3>
          <p className="text-[11px] text-[var(--text-muted)] font-mono-finance">Deterministic financial tool layer</p>
        </div>

        <button
          onClick={onClose}
          className="w-6 h-6 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-sub)] hover:text-[var(--text-main)] flex items-center justify-center text-xs font-bold transition-all border border-[var(--border-card)]"
        >
          ✕
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="px-3.5 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-card)] flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono-finance">
        <button
          onClick={() => handleSend(`Why didn't payment ${samplePaymentId} reconcile?`)}
          className="px-2 py-0.5 rounded bg-[var(--bg-inner)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] whitespace-nowrap border border-[var(--border-card)] transition-colors"
        >
          Payment Break
        </button>
        <button
          onClick={() => handleSend(`Explain MDR fee variance on ${sampleSettlementId}`)}
          className="px-2 py-0.5 rounded bg-[var(--bg-inner)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] whitespace-nowrap border border-[var(--border-card)] transition-colors"
        >
          MDR Fee Audit
        </button>
        <button
          onClick={() => handleSend('What is our auto-match accuracy rate and metrics summary?')}
          className="px-2 py-0.5 rounded bg-[var(--bg-inner)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] whitespace-nowrap border border-[var(--border-card)] transition-colors"
        >
          Metrics
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'user' ? (
              /* User message bubble: high contrast in both themes */
              <div className="max-w-[88%] rounded-lg p-3 leading-relaxed bg-[#0F172A] text-white shadow-sm">
                <div className="text-white text-xs font-medium whitespace-pre-line">
                  {msg.text}
                </div>
                <div className="text-[9px] mt-1 font-mono-finance text-slate-400 text-right">
                  {msg.timestamp}
                </div>
              </div>
            ) : (
              /* Agent message bubble: theme-aware with markdown formatting */
              <div className="max-w-[88%] rounded-lg p-3 leading-relaxed bg-[var(--bg-inner)] border border-[var(--border-card)] text-[var(--text-main)] shadow-sm">
                {/* Tool Execution Trace */}
                {msg.toolCalled && (
                  <div className="mb-2 pb-1.5 border-b border-[var(--border-card)] font-mono-finance text-[10px]">
                    <div className="text-[var(--text-sub)] font-semibold flex items-center gap-1">
                      <Terminal className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>{msg.toolCalled}()</span>
                    </div>
                    {msg.parameters && Object.keys(msg.parameters).length > 0 && (
                      <div className="text-[var(--text-muted)] text-[10px] truncate mt-0.5">
                        Args: {JSON.stringify(msg.parameters)}
                      </div>
                    )}
                  </div>
                )}

                {/* Formatted Markdown Rendering */}
                <div className="markdown-content text-xs">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xs font-bold text-[var(--text-emphasis)] mt-1 mb-1.5 pb-1 border-b border-[var(--border-card)] font-mono-finance" {...props} />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4 className="text-[11px] font-bold text-[var(--text-main)] mt-1 mb-1 font-mono-finance" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-1.5 leading-relaxed text-[var(--text-main)]" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-4 space-y-1 mb-2 text-[var(--text-sub)]" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-4 space-y-1 mb-2 text-[var(--text-sub)]" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="leading-relaxed text-[var(--text-main)]" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong className="font-semibold text-[var(--text-emphasis)]" {...props} />
                      ),
                      em: ({ node, ...props }) => (
                        <em className="text-[var(--text-muted)] italic" {...props} />
                      ),
                      code: ({ node, inline, ...props }: any) => (
                        <code className="px-1 py-0.2 rounded bg-[var(--bg-subtle)] border border-[var(--border-card)] text-[var(--text-main)] text-[10px] font-mono-finance" {...props} />
                      ),
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>

                <div className="text-[9px] mt-1.5 font-mono-finance text-[var(--text-muted)] text-right">
                  {msg.timestamp}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs pl-2 font-mono-finance">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-sub)] animate-pulse"></span>
            <span>Querying tool layer...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Query Input */}
      <div className="p-3 bg-[var(--bg-header)] border-t border-[var(--border-card)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about settlements, fees, UTRs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-md px-3 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-card-hover)] font-mono-finance"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="w-8 h-8 rounded-md bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] flex items-center justify-center disabled:opacity-50 transition-all font-semibold shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

    </div>
  );
};
