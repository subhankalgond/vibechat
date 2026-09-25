import { useEffect } from 'react';

const BASE_TITLE = 'VibeChat | Private messaging for real conversations';

/**
 * Shows total unread count in the tab title. When the count reaches zero
 * the title resets, so the base string stays defined in one place.
 */
export function useUnreadTitle(conversations) {
  useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    document.title = total > 0 ? `(${total}) VibeChat` : BASE_TITLE;
  }, [conversations]);
}
