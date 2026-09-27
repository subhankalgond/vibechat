import { useEffect, useState } from 'react';
import { Check, CheckCheck, Mic, Pencil, Play, SmilePlus, Timer, Trash2 } from 'lucide-react';
import { formatTime, formatBytes } from '../../utils/format';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

function StatusTicks({ message }) {
  if (!message.is_mine) return null;
  if (message.seen_at) {
    return (
      <span className="inline-flex items-center gap-0.5 text-sky-500 dark:text-sky-400" title="Seen">
        <CheckCheck size={14} strokeWidth={2.5} />
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

function AudioContent({ message, mine }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${mine ? 'bg-primary-700/40' : 'bg-neutral-100 dark:bg-neutral-700/60'}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${mine ? 'bg-white/15' : 'bg-primary-100 dark:bg-primary-900/40'}`}>
        <Mic size={15} className={mine ? 'text-white' : 'text-primary-600 dark:text-primary-400'} />
      </span>
      <audio
        src={message.media_url}
        controls
        preload="metadata"
        className="h-9 w-48 max-w-[180px] sm:w-56"
        style={mine ? { colorScheme: 'dark' } : undefined}
      />
    </div>
  );
}

function ReplyQuote({ replyTo, mine }) {
  if (!replyTo) return null;
  return (
    <div className={`mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 text-xs ${mine ? 'border-white/70 bg-white/10' : 'border-primary-500 bg-neutral-100 dark:bg-neutral-700/60'}`}>
      <span className={`block font-semibold ${mine ? 'text-white/90' : 'text-primary-600 dark:text-primary-400'}`}>
        {replyTo.sender_name || 'User'}
      </span>
      <span className={`line-clamp-2 block ${mine ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-300'}`}>
        {replyTo.type !== 'text' ? `📎 ${replyTo.type}` : replyTo.text}
      </span>
    </div>
  );
}

function ReactionBar({ reactions, mine }) {
  if (!reactions || !reactions.length) return null;
  const counts = new Map();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
  return (
    <div className={`-mt-1 flex flex-wrap gap-0.5 ${mine ? 'justify-end' : 'justify-start'} px-1`}>
      {[...counts.entries()].map(([emoji, count]) => (
        <span
          key={emoji}
          className="rounded-full border border-neutral-200 bg-white px-1.5 py-0.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          {emoji}{count > 1 && <span className="ml-0.5 text-[10px] font-semibold text-neutral-500">{count}</span>}
        </span>
      ))}
    </div>
  );
}

/** Live countdown for disappearing messages. */
function DisappearingTimer({ message }) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!message.disappears_after_seconds) return undefined;
    const tick = () => {
      const end = new Date(message.created_at).getTime() + message.disappears_after_seconds * 1000;
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setLeft(remaining);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [message.created_at, message.disappears_after_seconds]);
  if (left === null) return null;
  const label = left >= 3600 ? `${Math.floor(left / 3600)}h` : left >= 60 ? `${Math.floor(left / 60)}m` : `${left}s`;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" title="Disappearing message">
      <Timer size={12} /> {label}
    </span>
  );
}

export default function MessageBubble({
  message,
  onOpenMedia,
  onDelete,
  onReply,
  onReact,
  onEdit,
  isGroup,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mine = message.is_mine;
  const hasCaption = message.message_text && message.message_text.length > 0;

  const menuActions = [];
  if (onReply) menuActions.push({ label: 'Reply', action: () => onReply(message) });
  if (mine && message.message_type === 'text' && onEdit) {
    menuActions.push({ label: 'Edit', action: () => onEdit(message), icon: Pencil });
  }
  if (mine) {
    menuActions.push({ label: 'Delete for me', action: () => onDelete(message, false), danger: true });
    if (onEdit) menuActions.push({ label: 'Delete for everyone', action: () => onDelete(message, true), danger: true });
  }

  return (
    <div className={`group flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {mine && (
        <div className="mb-1 flex flex-col items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setPickerOpen((prev) => !prev)}
            className="rounded-full p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-primary-600 dark:hover:bg-neutral-800"
            aria-label="React"
            title="React"
          >
            <SmilePlus size={15} />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-full p-1 text-neutral-300 transition hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800"
            aria-label="Message options"
            title="Options"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'}`}>
        {isGroup && !mine && (
          <span className="mb-0.5 px-1 text-[11px] font-semibold text-primary-600 dark:text-primary-400">
            {message.sender_name || 'Member'}
          </span>
        )}

        {pickerOpen && (
          <div className="mb-1 flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-pop dark:border-neutral-700 dark:bg-neutral-800">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  if (onReact) onReact(message, emoji);
                }}
                className="rounded-full p-0.5 text-base transition hover:scale-125"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {menuOpen && (
          <div className="mb-1 flex flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 shadow-pop dark:border-neutral-700 dark:bg-neutral-800">
            {menuActions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  item.action();
                }}
                className={`text-left text-xs font-semibold ${item.danger ? 'text-red-600 hover:text-red-700 dark:text-red-400' : 'text-neutral-700 hover:text-neutral-900 dark:text-neutral-200 dark:hover:text-white'}`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="text-left text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
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
          <ReplyQuote replyTo={message.reply_to} mine={mine} />
          {message.message_type === 'image' && <ImageContent message={message} onOpen={onOpenMedia} />}
          {message.message_type === 'video' && <VideoContent message={message} onOpen={onOpenMedia} />}
          {message.message_type === 'audio' && <AudioContent message={message} mine={mine} />}
          {message.message_type === 'text' && <span className="whitespace-pre-wrap break-words">{message.message_text}</span>}
          {message.message_type !== 'text' && hasCaption && (
            <p className={`px-2 pb-1 pt-1.5 ${mine ? 'text-white' : 'text-neutral-800 dark:text-neutral-100'}`}>
              {message.message_text}
            </p>
          )}
        </div>

        <ReactionBar reactions={message.reactions} mine={mine} />

        <div className={`mt-1 flex items-center gap-1.5 px-1 text-[11px] text-neutral-400 dark:text-neutral-500 ${mine ? 'justify-end' : ''}`}>
          <span>{formatTime(message.created_at)}</span>
          {message.edited_at && <span className="italic">(edited)</span>}
          {message.disappears_after_seconds && <DisappearingTimer message={message} />}
          {mine && <StatusTicks message={message} />}
        </div>
      </div>

      {!mine && (
        <div className="mb-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setPickerOpen((prev) => !prev)}
            className="rounded-full p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-primary-600 dark:hover:bg-neutral-800"
            aria-label="React"
            title="React"
          >
            <SmilePlus size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
