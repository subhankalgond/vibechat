export function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatChatListTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startOfToday) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatLastSeen(iso) {
  if (!iso) return 'offline';
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'last seen just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `last seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `last seen ${days} d ago`;
  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
