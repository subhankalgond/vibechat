import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, UserRoundSearch } from 'lucide-react';
import api, { apiError } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatLastSeen } from '../../utils/format';

export default function Search() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const debounced = useDebounce(query, 300);
  const navigate = useNavigate();
  const requestRef = useRef(0);

  useEffect(() => {
    const term = debounced.trim();
    if (!term) {
      setUsers([]);
      setSearching(false);
      setSearched(false);
      setError('');
      return;
    }

    const requestId = ++requestRef.current;
    setSearching(true);
    setError('');

    api
      .get('/users/search', { params: { q: term } })
      .then((response) => {
        if (requestRef.current !== requestId) return;
        setUsers(response.data.data.users);
        setSearched(true);
      })
      .catch((err) => {
        if (requestRef.current !== requestId) return;
        setError(apiError(err).message);
      })
      .finally(() => {
        if (requestRef.current === requestId) setSearching(false);
      });
  }, [debounced]);

  function openProfile(username) {
    navigate(`/app/u/${username}`);
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Search</h1>
        <div className="relative mt-3">
          <SearchIcon size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username, e.g. sub"
            aria-label="Search users by username"
            autoFocus
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {searching ? (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={UserRoundSearch} title="Search failed" description={error} />
        ) : !query.trim() ? (
          <EmptyState
            icon={UserRoundSearch}
            title="Find people"
            description={'Search by username. Partial matches work too, so "sub" finds @subhan.'}
          />
        ) : !searched ? null : users.length === 0 ? (
          <EmptyState
            icon={UserRoundSearch}
            title="No users found"
            description={`No one matches "${query.trim()}". Check the spelling and try again.`}
          />
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => openProfile(user.username)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                >
                  <Avatar user={user} size="lg" showPresence />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {user.full_name}
                    </p>
                    <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                      @{user.username}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                    {user.is_online ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Online</span>
                    ) : (
                      formatLastSeen(user.last_seen)
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
