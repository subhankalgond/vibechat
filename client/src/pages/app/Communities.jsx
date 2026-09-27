import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Copy, Plus, Users, X } from 'lucide-react';

import api, { apiError } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import EmptyState from '../../components/ui/EmptyState';
import { formatChatListTime } from '../../utils/format';

function EventRow({ event, onRsvp }) {
  const date = event.event_at ? new Date(event.event_at) : null;
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{event.title}</span>
        {date && (
          <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
            {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {' · '}
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      {event.description && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{event.description}</p>}
      {event.location && <p className="mt-0.5 text-xs text-neutral-400">📍 {event.location}</p>}
      <div className="mt-2 flex items-center gap-1.5">
        {[
          { key: 'going', label: 'Going' },
          { key: 'maybe', label: 'Maybe' },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onRsvp(event.id, option.key)}
            className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-300"
          >
            {option.label}
          </button>
        ))}
        <span className="ml-1 text-xs text-neutral-400">{event.going_count} going</span>
      </div>
    </div>
  );
}

function CreateCommunityModal({ onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const response = await api.post('/communities', { name: name.trim(), description: description.trim() });
      onCreated(response.data.data);
    } catch (err) {
      toast.error(apiError(err).message);
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-pop dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Create community</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label htmlFor="community_name" className="sr-only">Name</label>
        <input
          id="community_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Community name (e.g. College, Groups, Events)"
          maxLength={80}
          className="mt-3 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <label htmlFor="community_desc" className="sr-only">Description</label>
        <textarea
          id="community_desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is it about? (optional)"
          maxLength={500}
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <button
          type="button"
          onClick={create}
          disabled={!name.trim() || creating}
          className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}

function EventModal({ communityId, onClose, onCreated }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventAt, setEventAt] = useState('');
  const [location, setLocation] = useState('');
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      await api.post(`/communities/${communityId}/events`, {
        title: title.trim(),
        description: description.trim(),
        event_at: eventAt ? new Date(eventAt).toISOString() : null,
        location: location.trim(),
      });
      onCreated();
    } catch (err) {
      toast.error(apiError(err).message);
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-pop dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">New event</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" maxLength={120} className="mt-3 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" rows={2} maxLength={1000} className="mt-2 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100" aria-label="Event date and time" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" maxLength={200} className="rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100" />
        </div>
        <button type="button" onClick={create} disabled={!title.trim() || creating} className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {creating ? 'Creating...' : 'Create event'}
        </button>
      </div>
    </div>
  );
}

export default function Communities() {
  const toast = useToast();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [eventFor, setEventFor] = useState(null); // community id

  const load = useCallback(async () => {
    try {
      const response = await api.get('/communities');
      setCommunities(response.data.data.communities);
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function joinByCode() {
    if (!joinCode.trim()) return;
    try {
      const response = await api.post('/communities/join', { invite_code: joinCode.trim() });
      toast.success(`Joined ${response.data.data.name}`);
      setJoinCode('');
      load();
    } catch (err) {
      toast.error(apiError(err).message);
    }
  }

  async function leave(id) {
    try {
      await api.delete(`/communities/${id}`);
      load();
    } catch (err) {
      toast.error(apiError(err).message);
    }
  }

  async function rsvp(eventId, response) {
    try {
      await api.post(`/communities/events/${eventId}/rsvp`, { response });
      toast.success('RSVP saved');
      load();
    } catch (err) {
      toast.error(apiError(err).message);
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(
      () => toast.success('Invite code copied'),
      () => toast.error('Could not copy')
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Communities</h1>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <Plus size={14} /> Create
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter invite code to join..."
            className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            aria-label="Invite code"
          />
          <button type="button" onClick={joinByCode} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300">
            Join
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-neutral-400">Loading communities...</p>
        ) : communities.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No communities yet"
            description="Create one for your college, friend groups, or events — or join with an invite code."
          />
        ) : (
          <div className="space-y-4">
            {communities.map((community) => (
              <div key={community.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{community.name}</h2>
                    {community.description && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{community.description}</p>}
                    <p className="mt-1 text-xs text-neutral-400">
                      {community.member_count} member{community.member_count === 1 ? '' : 's'}
                      {community.my_role === 'admin' && ' · you are admin'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button type="button" onClick={() => copyCode(community.invite_code)} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300" title="Copy invite code">
                      <Copy size={11} /> {community.invite_code}
                    </button>
                    <button type="button" onClick={() => leave(community.id)} className="text-[11px] font-medium text-red-500 hover:text-red-600">
                      {community.my_role === 'admin' ? 'Delete' : 'Leave'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {community.events.length === 0 ? (
                    <p className="text-xs text-neutral-400">No events yet.</p>
                  ) : (
                    community.events.map((event) => <EventRow key={event.id} event={event} onRsvp={rsvp} />)
                  )}
                  <button
                    type="button"
                    onClick={() => setEventFor(community.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    <CalendarPlus size={13} /> Add event
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateCommunityModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
            toast.success('Community created');
          }}
        />
      )}
      {eventFor && <EventModal communityId={eventFor} onClose={() => setEventFor(null)} onCreated={() => { setEventFor(null); load(); }} />}
    </div>
  );
}
