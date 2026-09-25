import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
        <Compass size={26} />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-neutral-900 dark:text-neutral-50">Page not found</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-neutral-500 dark:text-neutral-400">
        The page you are looking for does not exist or was moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
      >
        Go home
      </Link>
    </div>
  );
}
