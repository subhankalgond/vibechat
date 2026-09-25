import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import api, { apiError } from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { ProfileSkeleton } from '../../components/ui/Skeleton';
import { ButtonSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../hooks/useToast';
import { useConversations } from '../../hooks/useConversations';
import { formatLastSeen } from '../../utils/format';

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', user: null, conversationId: null });
  const [messaging, setMessaging] = useState(false);
  const { toast } = useToast();
  const { refresh: refreshConversations } = useConversations();

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', user: null, conversationId: null });

    api
      .get(`/users/${encodeURIComponent(username)}`)
      .then((response) => {
        if (cancelled) return;
        const { user: fetched, conversationId } = response.data.data;
        setState({ status: 'ready', user: fetched, conversationId });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.response && error.response.status === 404) {
          setState({ status: 'not_found', user: null, conversationId: null });
        } else {
          setState({ status: 'error', user: null, conversationId: null, message: apiError(error).message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  async function handleMessage() {
    if (messaging) return;
    setMessaging(true);
    try {
      // Create the conversation if it does not exist yet, then open it.
      const response = await api.post('/conversations', { username: state.user.username });
      // The new conversation should appear in the Chats list immediately.
      refreshConversations();
      navigate(`/app/messages/${response.data.data.id}`);
    } catch (error) {
      toast.error(apiError(error).message);
      setMessaging(false);
    }
  }

  if (state.status === 'loading') return <ProfileSkeleton />;

  if (state.status === 'not_found') {
    return (
      <div className="h-full overflow-y-auto bg-white dark:bg-neutral-900">
        <div className="mx-auto max-w-lg px-4 pt-8 sm:px-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <EmptyState
          icon={MessageCircle}
          title="User not found"
          description={`No account with the username @${username}.`}
          action={
            <button
              type="button"
              onClick={() => navigate('/app/search')}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Search users
            </button>
          }
        />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="h-full overflow-y-auto bg-white dark:bg-neutral-900">
        <EmptyState
          icon={MessageCircle}
          title="Something went wrong"
          description={state.message}
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Reload
            </button>
          }
        />
      </div>
    );
  }

  const { user: profile } = state;

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <Avatar user={profile} size="full" />
          <h1 className="mt-4 text-lg font-bold text-neutral-900 dark:text-neutral-100">{profile.full_name}</h1>
          <p className="text-sm text-primary-600 dark:text-primary-400">@{profile.username}</p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            {profile.is_online ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Online</span>
            ) : (
              formatLastSeen(profile.last_seen)
            )}
          </p>
          {profile.bio && (
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {profile.bio}
            </p>
          )}

          <button
            type="button"
            onClick={handleMessage}
            disabled={messaging}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {messaging ? <ButtonSpinner size={15} /> : <MessageCircle size={17} />}
            Message
          </button>
        </div>
      </div>
    </div>
  );
}
