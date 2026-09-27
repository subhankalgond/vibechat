import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Eye, Plus, Sprout, Type, X } from 'lucide-react';

import api, { apiError } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { validateMediaFile } from '../../utils/mediaValidation';

const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#4f46e5'];

function AddStatusModal({ onClose, onCreated }) {
  const toast = useToast();
  const [mode, setMode] = useState('text');
  const [content, setContent] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [media, setMedia] = useState(null); // { file, url, kind }
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef(null);

  function pickFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const error = validateMediaFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setMedia({ file, url: URL.createObjectURL(file), kind: file.type.startsWith('video/') ? 'video' : 'image' });
  }

  async function post() {
    setPosting(true);
    try {
      let body;
      if (mode === 'text') {
        body = { status_type: 'text', content: content.trim(), background_color: color };
      } else {
        const formData = new FormData();
        formData.append(media.kind, media.file);
        const upload = await api.post(media.kind === 'video' ? '/upload/video' : '/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        body = {
          status_type: media.kind,
          media: upload.data.data,
          caption: caption.trim(),
        };
      }
      await api.post('/statuses', body);
      onCreated();
    } catch (err) {
      toast.error(apiError(err).message);
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-pop dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Add status</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setMode('text')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === 'text' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
              <Type size={12} className="mr-1 inline" /> Text
            </button>
            <button type="button" onClick={() => { setMode('media'); fileInputRef.current && fileInputRef.current.click(); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === 'media' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
              <Camera size={12} className="mr-1 inline" /> Photo / Video
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="hidden" onChange={pickFile} aria-label="Status media" />

          {mode === 'text' ? (
            <>
              <div className="mt-4 flex aspect-[3/4] max-h-72 items-center justify-center rounded-2xl p-6" style={{ backgroundColor: color }}>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your status..."
                  maxLength={700}
                  className="h-full w-full resize-none bg-transparent text-center text-lg font-semibold text-white placeholder-white/60 focus:outline-none"
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-neutral-900 dark:border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
                ))}
              </div>
            </>
          ) : media ? (
            <div className="mt-4">
              {media.kind === 'image' ? (
                <img src={media.url} alt="Status preview" className="mx-auto max-h-64 rounded-2xl" />
              ) : (
                <video src={media.url} controls className="mx-auto max-h-64 rounded-2xl" />
              )}
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption (optional)"
                maxLength={700}
                className="mt-3 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
              <Camera size={28} className="mx-auto text-neutral-400" />
              <p className="mt-2 text-sm text-neutral-500">Pick a photo or video to share for 24 hours.</p>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={post}
            disabled={posting || (mode === 'text' ? !content.trim() : !media)}
            className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {posting ? 'Posting...' : 'Post status (24h)'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusViewer({ statusGroup, onClose }) {
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [viewers, setViewers] = useState(null);
  const status = statusGroup.items[index];

  useEffect(() => {
    if (!status || status.is_mine) return undefined;
    api.post(`/statuses/${status.id}/view`).catch(() => {});
    return undefined;
  }, [status]);

  useEffect(() => {
    setViewers(null);
    if (!status || !status.is_mine) return undefined;
    api
      .get(`/statuses/${status.id}/views`)
      .then((res) => setViewers(res.data.data.viewers))
      .catch(() => setViewers([]));
    return undefined;
  }, [status]);

  if (!status) return null;

  async function remove() {
    try {
      await api.delete(`/statuses/${status.id}`);
      toast.success('Status deleted');
      onClose();
    } catch (err) {
      toast.error(apiError(err).message);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-neutral-950/95" role="dialog" aria-modal="true">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar user={statusGroup.user} size="sm" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{statusGroup.user.full_name}</p>
          <p className="text-xs text-white/60">{statusGroup.is_mine ? 'Your status' : `@${statusGroup.user.username}`}</p>
        </div>
        {status.is_mine && (
          <button type="button" onClick={remove} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-white/10">
            Delete
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/10" aria-label="Close status">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-8">
        {status.status_type === 'text' ? (
          <div className="flex aspect-[3/4] max-h-[70vh] w-full max-w-sm items-center justify-center rounded-3xl p-8" style={{ backgroundColor: status.background_color || '#7c3aed' }}>
            <p className="text-center text-xl font-semibold text-white">{status.content}</p>
          </div>
        ) : status.status_type === 'image' ? (
          <img src={status.media_url} alt="Status" className="max-h-[70vh] rounded-3xl" />
        ) : (
          <video src={status.media_url} controls autoPlay className="max-h-[70vh] rounded-3xl" />
        )}
      </div>

      <div className="flex items-center justify-between px-6 pb-6">
        <button type="button" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30">
          Prev
        </button>
        {status.is_mine && viewers && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
            <Eye size={13} /> {viewers.length} view{viewers.length === 1 ? '' : 's'}
            {viewers.length > 0 && <span className="ml-1 hidden max-w-40 truncate sm:inline">({viewers.map((v) => v.username).join(', ')})</span>}
          </span>
        )}
        <button type="button" disabled={index >= statusGroup.items.length - 1} onClick={() => setIndex((i) => Math.min(statusGroup.items.length - 1, i + 1))} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30">
          Next
        </button>
      </div>
    </div>
  );
}

export default function Status() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState({ mine: null, others: [] });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/statuses');
      setData(response.data.data);
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const Ring = ({ item, seen }) => (
    <span className={`flex h-14 w-14 items-center justify-center rounded-full p-[2.5px] ${seen ? 'bg-neutral-300 dark:bg-neutral-700' : 'bg-gradient-to-tr from-primary-500 to-pink-500'}`}>
      {item}
    </span>
  );

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Status</h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={14} /> Add status
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-neutral-400">Loading statuses...</p>
        ) : (
          <>
            {/* My status */}
            <button
              type="button"
              onClick={() => data.mine && setViewing(data.mine)}
              className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-neutral-50 disabled:opacity-60 dark:hover:bg-neutral-800/60"
              disabled={!data.mine}
            >
              <Ring item={<Avatar user={user} size="lg" />} seen={Boolean(data.mine)} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">My status</span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {data.mine ? `${data.mine.items.length} update${data.mine.items.length === 1 ? '' : 's'} - tap to view` : 'Tap "Add status" to share'}
                </span>
              </span>
            </button>

            <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-neutral-400">Recent</h2>
            {data.others.length === 0 ? (
              <EmptyState icon={Sprout} title="No recent statuses" description="Statuses from people you chat with appear here for 24 hours." />
            ) : (
              <ul className="mt-2 space-y-1">
                {data.others.map((group) => {
                  const allSeen = group.items.every((item) => item.viewed);
                  return (
                    <li key={group.user.id}>
                      <button type="button" onClick={() => setViewing(group)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                        <Ring item={<Avatar user={group.user} size="lg" />} seen={allSeen} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{group.user.full_name}</span>
                          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {group.items.length} update{group.items.length === 1 ? '' : 's'} · {new Date(group.items[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {adding && (
        <AddStatusModal
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            load();
            toast.success('Status posted');
          }}
        />
      )}
      {viewing && <StatusViewer statusGroup={viewing} onClose={() => { setViewing(null); load(); }} />}
    </div>
  );
}
