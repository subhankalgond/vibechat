import { useEffect } from 'react';
import { Download, Volume2, VolumeX, X } from 'lucide-react';

export default function MediaViewer({ media, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!media) return null;
  const isVideo = media.message_type === 'video';

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'Video viewer' : 'Photo viewer'}
    >
      <div className="flex items-center justify-between p-3">
        <p className="max-w-[60%] truncate text-sm text-neutral-300">
          {media.file_name || (isVideo ? 'Video' : 'Photo')}
        </p>
        <div className="flex items-center gap-1">
          <a
            href={media.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Open in new tab"
            title="Open in new tab"
          >
            <Download size={19} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close viewer"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-2 pb-6">
        {isVideo ? (
          <video
            src={media.media_url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <img
            src={media.media_url}
            alt={media.file_name || 'Shared photo'}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}
      </div>

      {isVideo && (
        <p className="pb-3 text-center text-xs text-neutral-500">
          Use the player controls for volume and fullscreen.
        </p>
      )}
    </div>
  );
}
