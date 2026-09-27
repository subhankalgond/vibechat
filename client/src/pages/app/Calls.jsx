import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react';

import api, { apiError } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { formatChatListTime } from '../../utils/format';

function statusMeta(call) {
  if (call.status === 'missed') {
    return { label: 'Missed', className: 'text-red-500', Icon: PhoneMissed };
  }
  if (call.status === 'declined') {
    return { label: 'Declined', className: 'text-red-400', Icon: PhoneIncoming };
  }
  if (call.status === 'cancelled') {
    return { label: 'Cancelled', className: 'text-neutral-400', Icon: PhoneOutgoing };
  }
  return { label: 'Completed', className: 'text-emerald-500', Icon: call.direction === 'outgoing' ? PhoneOutgoing : PhoneIncoming };
}

function durationLabel(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export default function Calls() {
  const toast = useToast();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/calls');
      setCalls(response.data.data.calls);
      setError(null);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeCall(id) {
    try {
      await api.delete(`/calls/${id}`);
      setCalls((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(apiError(err).message);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Calls</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-sm text-neutral-400">Loading calls...</p>
        ) : error ? (
          <EmptyState icon={Phone} title="Could not load calls" description={error} />
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No calls yet"
            description="Start a voice or video call from any chat header and it will show up here."
            action={
              <Link to="/app/messages" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                Go to chats
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {calls.map((call) => {
              const meta = statusMeta(call);
              return (
                <li key={call.id} className="group flex items-center gap-3 px-4 py-3.5 sm:px-6">
                  <Avatar user={call.counterpart} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {call.counterpart.full_name}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                        {formatChatListTime(call.started_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <meta.Icon size={13} className={meta.className} />
                      <span className={meta.className}>{meta.label}</span>
                      <span className="text-neutral-400">·</span>
                      <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                        {call.call_type === 'video' ? <Video size={12} /> : <Phone size={12} />}
                        {call.call_type === 'video' ? 'Video' : 'Voice'}
                      </span>
                      {call.status === 'completed' && durationLabel(call.duration_seconds) && (
                        <>
                          <span className="text-neutral-400">·</span>
                          <span className="text-neutral-500 dark:text-neutral-400">{durationLabel(call.duration_seconds)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCall(call.id)}
                    className="rounded-full p-1.5 text-neutral-300 opacity-0 transition hover:bg-neutral-100 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-neutral-800"
                    aria-label="Delete call entry"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
