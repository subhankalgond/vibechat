import { useEffect, useRef, useState } from 'react';
import { ListChecks, Languages, Send, Sparkles } from 'lucide-react';

import api, { apiError } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { useConversations } from '../../hooks/useConversations';

export default function VibeAI() {
  const toast = useToast();
  const { conversations } = useConversations();
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const response = await api.post('/vibeai/chat', { messages: next });
      const data = response.data.data;
      if (data.configured === false) {
        setNotConfigured(true);
        toast.error(data.message);
        setMessages(next.slice(0, -1));
      } else {
        setMessages([...next, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      toast.error(apiError(err).message);
      setMessages(next.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  async function translateLast() {
    if (!messages.length) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setBusy(true);
    try {
      const response = await api.post('/vibeai/translate', {
        text: lastUser.content,
        target_language: 'English',
      });
      const data = response.data.data;
      if (data.configured === false) {
        setNotConfigured(true);
        toast.error(data.message);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `🌐 Translation: ${data.translation}` }]);
      }
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function summarizeChat() {
    const group = conversations.find((c) => c.type === 'group');
    const target = group || conversations[0];
    if (!target) {
      toast.error('Start a conversation first, then I can summarize it.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post('/vibeai/summarize', { conversation_id: target.id });
      const data = response.data.data;
      if (data.configured === false) {
        setNotConfigured(true);
        toast.error(data.message);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `📝 Summary of "${group ? group.name || 'group' : target.other_user.full_name}":\n${data.summary}` },
        ]);
      }
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 to-pink-500 text-white">
            <Sparkles size={17} />
          </span>
          <div>
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-50">VibeAI</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Your in-chat assistant</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={translateLast}
            disabled={busy || !messages.length}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-300"
            title="Translate your last message to English"
          >
            <Languages size={13} /> Translate
          </button>
          <button
            type="button"
            onClick={summarizeChat}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-300"
            title="Summarize your most recent conversation"
          >
            <ListChecks size={13} /> Summarize chat
          </button>
        </div>
      </header>

      {notConfigured && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          VibeAI needs a free Gemini key: create one at <b>aistudio.google.com</b>, then add <b>VIBEAI_API_KEY</b> in Render → Environment. Redeploy not needed — Render restarts on save.
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 to-pink-500 text-white shadow-lg">
              <Sparkles size={28} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-neutral-900 dark:text-neutral-50">Hey, I'm VibeAI</h2>
            <p className="mt-1 max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
              Ask me anything, translate a message, or summarize a chat with the buttons above.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-primary-600 text-white'
                    : 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                }`}
              >
                {message.content}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1.5 bg-white px-4 py-3 rounded-2xl self-start shadow-sm dark:bg-neutral-800">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:240ms]" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask VibeAI anything..."
            rows={1}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            aria-label="Message VibeAI"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
            aria-label="Send"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
