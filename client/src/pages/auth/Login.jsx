import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ButtonSpinner } from '../../components/ui/Spinner';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (!identifier.trim()) {
      setError('Enter your email or username.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setSubmitting(true);
    const result = await login({ identifier: identifier.trim(), password, remember });
    setSubmitting(false);

    if (result.success) {
      toast.success('Welcome back.');
      navigate('/app/messages', { replace: true });
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-950">
      <Link to="/login" className="mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">VibeChat</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Sign in</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Use your email or username to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Email or username
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder="Your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-neutral-900"
            >
              {submitting && <ButtonSpinner />}
              {submitting ? 'Signing in' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-neutral-500 dark:text-neutral-400">
          New to VibeChat?{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Create an account
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
          By continuing you agree to our{' '}
          <Link to="/terms" className="underline hover:text-neutral-600 dark:hover:text-neutral-300">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500';

export function BrandMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M9 11.5A3.5 3.5 0 0 1 12.5 8h7A3.5 3.5 0 0 1 23 11.5v5a3.5 3.5 0 0 1-3.5 3.5H14l-4.2 3.4c-.5.4-1.3 0-1.3-.7V11.5z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
