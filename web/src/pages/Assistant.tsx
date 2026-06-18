import { useRef, useState, useEffect } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { getAuthToken } from '../lib/api';
import { PageHeader } from '../components/ui';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What is the overall health of the network right now?',
  'Which chargers are offline or faulted, and why?',
  'Summarise today’s energy and revenue.',
  'Diagnose the most recent fault and suggest a next step.',
];

export function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history = messages.slice(-8);
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.body) throw new Error('No response stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: `Sorry — ${(e as Error).message}`,
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <PageHeader
        title="Ops Assistant"
        subtitle="Ask about network health, faults and sessions — powered by Claude"
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto card p-4 sm:p-5 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center">
            <div className="max-w-md">
              <div className="grid place-items-center w-12 h-12 rounded-xl bg-accent/15 text-accent mx-auto">
                <Sparkles size={24} />
              </div>
              <p className="text-slate-300 mt-3 font-medium">
                Ask anything about your charging network
              </p>
              <p className="text-sm text-slate-500 mt-1">
                The assistant sees live charger status, alerts, sessions and metrics.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 mt-5 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-sm text-slate-300 rounded-lg border border-ink-600/60 px-3 py-2 hover:border-accent/50 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${
                  m.role === 'user'
                    ? 'bg-ink-600/60 text-slate-300'
                    : 'bg-accent/15 text-accent'
                }`}
              >
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="text-xs text-slate-500 mb-1">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {m.content || (busy && i === messages.length - 1 ? '…' : '')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about chargers, faults, sessions, revenue…"
          className="input flex-1"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn-primary">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
