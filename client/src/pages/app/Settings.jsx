import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Moon, Palette, Sun, UserCog } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/ui/Avatar';

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Settings</h1>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Avatar user={user} size="xl" showPresence />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">{user.full_name}</p>
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">@{user.username}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <h2 className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400">
            Appearance
          </h2>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
            aria-pressed={theme === 'dark'}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Dark mode</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {theme === 'dark' ? 'On. Tap to switch to light.' : 'Off. Tap to switch to dark.'}
              </span>
            </span>
            <Palette size={16} className="text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <h2 className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400">
            Account
          </h2>
          <Link
            to="/app/profile"
            className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3.5 transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
              <UserCog size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Edit profile</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">Name, username, bio, photo</span>
            </span>
            <ChevronRight size={16} className="text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              <UserCog size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Email</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">{user.email}</span>
            </span>
          </div>
        </section>

        <button
          type="button"
          onClick={async () => {
            await logout();
            toast.info('Signed out.');
            navigate('/login', { replace: true });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          <LogOut size={16} />
          Log out
        </button>

        <p className="pt-2 text-center text-xs text-neutral-400 dark:text-neutral-600">
          VibeChat v1.0
        </p>
      </div>
    </div>
  );
}
