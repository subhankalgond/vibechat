import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import api, { apiError } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { validateMediaFile } from '../../utils/mediaValidation';
import { formatBytes } from '../../utils/format';
import { ButtonSpinner } from '../ui/Spinner';

export default function Composer({ conversationId, onMessageSent, onTypingStart, onTypingStop, disabled }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null); // { file, url, kind }
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef(null);
  const typingRef = useRef(false);
  const typingTimerRef = useRef(null);

  // Revoke object URLs when preview changes or unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function handleFileChange(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateMediaFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setCaption('');
    setPreview({
      file,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith('video/') ? 'video' : 'image',
    });
  }

  function cancelPreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setCaption('');
    setProgress(0);
  }

  function notifyTyping() {
    if (typingRef.current) return;
    typingRef.current = true;
    onTypingStart();
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingRef.current = false;
      onTypingStop();
    }, 2500);
  }

  function handleTextChange(event) {
    setText(event.target.value);
    if (event.target.value.trim()) notifyTyping();
  }

  async function uploadMedia() {
    const formData = new FormData();
    formData.append(preview.kind === 'video' ? 'video' : 'image', preview.file);
    const response = await api.post(
      preview.kind === 'video' ? '/upload/video' : '/upload/image',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
        },
      }
    );
    return response.data.data;
  }

  async function sendMediaMessage() {
    setUploading(true);
    setProgress(0);
    try {
      const media = await uploadMedia();
      const response = await api.post('/messages', {
        conversation_id: conversationId,
        message_type: media.media_type,
        message_text: caption.trim(),
        media,
      });
      onMessageSent(response.data.data.message);
      cancelPreview();
    } catch (error) {
      toast.error(apiError(error).message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleSend() {
    if (disabled || sending) return;

    if (preview) {
      await sendMediaMessage();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const response = await api.post('/messages', {
        conversation_id: conversationId,
        message_type: 'text',
        message_text: trimmed,
      });
      setText('');
      onTypingStop();
      typingRef.current = false;
      clearTimeout(typingTimerRef.current);
      onMessageSent(response.data.data.message);
    } catch (error) {
      toast.error(apiError(error).message);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const canSend = !disabled && !sending && (preview || text.trim().length > 0);

  return (
    <>
      <div className="border-t border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-4">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Attach photo or video"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={disabled || uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Attach photo or video"
            title="Attach photo or video"
          >
            <Paperclip size={19} />
          </button>

          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (typingRef.current) {
                typingRef.current = false;
                onTypingStop();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            disabled={disabled}
            aria-label="Message text"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            {sending || uploading ? <ButtonSpinner size={17} /> : <Send size={17} />}
          </button>
        </div>
        <p className="mt-1.5 hidden px-12 text-[11px] text-neutral-400 dark:text-neutral-600 sm:block">
          Enter to send, Shift + Enter for a new line.
        </p>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Media preview"
        >
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-pop dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Send {preview.kind === 'video' ? 'video' : 'photo'}
              </h2>
              <button
                type="button"
                onClick={cancelPreview}
                disabled={uploading}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
                aria-label="Cancel"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-neutral-100 dark:bg-neutral-950">
              {preview.kind === 'image' ? (
                <img src={preview.url} alt="Selected preview" className="mx-auto max-h-72 w-auto object-contain" />
              ) : (
                <video src={preview.url} controls muted playsInline className="mx-auto max-h-72 w-auto" />
              )}
              <p className="px-4 pt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
                {preview.file.name} | {formatBytes(preview.file.size)}
              </p>
            </div>

            {uploading && (
              <div className="px-4 pt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  Uploading... {progress}%
                </p>
              </div>
            )}

            <div className="p-4">
              <label htmlFor="media_caption" className="sr-only">
                Caption
              </label>
              <input
                id="media_caption"
                type="text"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Add a caption (optional)"
                maxLength={1000}
                disabled={uploading}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={cancelPreview}
                  disabled={uploading}
                  className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendMediaMessage}
                  disabled={uploading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  {uploading ? 'Uploading' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
