import { useState } from 'react';
import { Check, CheckCheck, Clock, Play, Trash2 } from 'lucide-react';
import { formatTime, formatBytes } from '../../utils/format';

function StatusTicks({ message }) {
  if (!message.is_mine) return null;
  if (message.seen_at) {
    return (
      <span className="inline-flex items-center gap-0.5 text-primary-300 dark:text-primary-500" title="Seen">
        <CheckCheck size={14} />
      </span>
    );
  }
  if (message.delivered_at) {
    return (
      <span className="text-neutral-400 dark:text-neutral-500" title="Delivered">
        <CheckCheck size={14} />
      </span>
    );
  }
  return (
    <span className="text-neutral-400 dark:text-neutral-500" title="Sent">
      <Check size={14} />
    </span>
  );
}

function ImageContent({ message, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(message)}
      className="block max-w-[260px] overflow-hidden rounded-xl"
      aria-label="Open photo"
    >
      <img
        src={message.media_url}
        alt={message.file_name || 'Shared photo'}
        loading="lazy"
        className="h-auto w-full object-cover transition hover:opacity-90"
      />
    </button>
  );
}

function VideoContent({ message, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(message)}
      className="group relative block max-w-[260px] overflow-hidden rounded-xl bg-neutral-900"
      aria-label="Open video"
    >
      <video
        src={`${message.media_url}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        className="h-auto w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow transition group-hover:scale-105">
          <Play size={20} className="ml-0.5" fill="currentColor" />
        </span>
      </span>
      {message.file_size && (
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {formatBytes(message.file_size)}
        </span>
      )}
    </button>
  );
}

export default function MessageBubble({ message, onOpenMedia, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mine = message.is_mine;
  const hasCaption = message.message_text && message.message_text.length > 0;

  return (
    <div className={`group flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {mine && (
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="mb-1 rounded-full p-1 text-neutral-300 opacity-0 transition hover:bg-neutral-100 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-neutral-800"
          aria-label="Delete message"
          title="Delete for me"
        >
          <Trash2 size={14} />
        </button>
      )}

      <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {menuOpen && mine && (
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 shadow-pop dark:border-neutral-700 dark:bg-neutral-800">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Delete for me?</span>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete(message);
              }}
              className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
            >
              Cancel
            </button>
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
            mine
              ? 'bg-primary-600 text-white'
              : 'bg-white text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100'
          } ${message.message_type !== 'text' ? 'p-1.5' : ''}`}
        >
          {message.message_type === 'image' && <ImageContent message={message} onOpen={onOpenMedia} />}
          {message.message_type === 'video' && <VideoContent message={message} onOpen={onOpenMedia} />}
          {message.message_type === 'text' && <span className="whitespace-pre-wrap break-words">{message.message_text}</span>}
          {message.message_type !== 'text' && hasCaption && (
            <p className={`px-2 pb-1 pt-1.5 ${mine ? 'text-white' : 'text-neutral-800 dark:text-neutral-100'}`}>
              {message.message_text}
            </p>
          )}
        </div>

        <div className={`mt-1 flex items-center gap-1.5 px-1 text-[11px] text-neutral-400 dark:text-neutral-500 ${mine ? 'justify-end' : ''}`}>
          <span>{formatTime(message.created_at)}</span>
          {mine && <StatusTicks message={message} />}
        </div>
      </div>
    </div>
  );
}
