import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Eye, KeyRound, LogOut, Moon, Palette, ShieldCheck, Sun, UserCog } from 'lucide-react';
import api, { apiError } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/ui/Avatar';
import { setToken } from '../../services/api';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  // Privacy + security state
  const [privacy, setPrivacy] = useState({
    last_seen_visibility: user.last_seen_visibility || 'everyone',
    profile_photo_visibility: user.profile_photo_visibility || 'everyone',
    read_receipts_enabled: user.read_receipts_enabled !== false,
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [pwOpen, setPwOpen] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  async function savePrivacy(patch) {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    try {
      const response = await api.put('/users/privacy', patch);
      if (setUser && response.data.data.user) setUser(response.data.data.user);
    } catch (err) {
      toast.error(apiError(err).message);
      setPrivacy(privacy); // revert on failure
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (pwForm.new_password.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    setSavingPw(true);
    try {
      const response = await api.put('/users/password', pwForm);
      if (response.data.data.token) setToken(response.data.data.token);
      if (setUser && response.data.data.user) setUser(response.data.data.user);
      setPwForm({ current_password: '', new_password: '' });
      setPwOpen(false);
      toast.success('Password changed');
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setSavingPw(false);
    }
  }

  const VISIBILITY_LABELS = {
    everyone: 'Everyone',
    contacts: 'My contacts',
    nobody: 'Nobody',
  };

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
            Privacy
          </h2>
          <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3.5 dark:border-neutral-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
              <Eye size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Last seen & online</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">Who can see when you were last active</span>
            </span>
            <select
              value={privacy.last_seen_visibility}
              onChange={(e) => savePrivacy({ last_seen_visibility: e.target.value })}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              aria-label="Last seen visibility"
            >
              {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3.5 dark:border-neutral-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
              <Eye size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Profile photo</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">Who can see your profile picture</span>
            </span>
            <select
              value={privacy.profile_photo_visibility}
              onChange={(e) => savePrivacy({ profile_photo_visibility: e.target.value })}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              aria-label="Profile photo visibility"
            >
              {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
              <Eye size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Read receipts</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {privacy.read_receipts_enabled ? 'Blue ticks are sent when you read messages.' : 'Others will not see blue ticks from you.'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => savePrivacy({ read_receipts_enabled: !privacy.read_receipts_enabled })}
              role="switch"
              aria-checked={privacy.read_receipts_enabled}
              className={`relative h-6 w-11 rounded-full transition ${privacy.read_receipts_enabled ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${privacy.read_receipts_enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <h2 className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400">
            Security
          </h2>
          {pwOpen ? (
            <form onSubmit={changePassword} className="space-y-2.5 px-4 py-3.5">
              <input
                type="password"
                value={pwForm.current_password}
                onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))}
                placeholder="Current password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <input
                type="password"
                value={pwForm.new_password}
                onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setPwOpen(false)} className="flex-1 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                  Cancel
                </button>
                <button type="submit" disabled={savingPw} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {savingPw ? 'Saving...' : 'Save password'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setPwOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
                <KeyRound size={18} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Change password</span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">Use 8+ characters</span>
              </span>
              <ShieldCheck size={16} className="text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
            </button>
          )}
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
