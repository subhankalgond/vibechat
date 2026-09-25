import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, MessageCircle, Search, Settings, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Avatar from '../components/ui/Avatar';
import BrandMark from '../components/common/BrandMark';

const NAV_ITEMS = [
  { to: '/app/messages', label: 'Chats', icon: MessageCircle, end: true },
  { to: '/app/search', label: 'Search', icon: Search, end: false },
  { to: '/app/profile', label: 'Profile', icon: User, end: false },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    toast.info('Signed out.');
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark />
          <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50">VibeChat</span>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
                }`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}

          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              }`
            }
          >
            <Settings size={19} />
            Settings
          </NavLink>
        </nav>

        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <NavLink
            to="/app/profile"
            className="mb-1 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Avatar user={user} size="md" showPresence />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {user && user.full_name}
              </span>
              <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                @{user && user.username}
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <main className="relative min-w-0 flex-1 overflow-hidden pb-14 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:hidden"
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isActive ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500 dark:text-neutral-400'
              }`
            }
          >
            <Icon size={21} />
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500 dark:text-neutral-400'
            }`
          }
        >
          <Settings size={21} />
          Settings
        </NavLink>
      </nav>
    </div>
  );
}
