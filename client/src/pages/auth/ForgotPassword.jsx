import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { BrandMark, inputClass } from './Login';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-950">
      <Link to="/login" className="mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">VibeChat</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
            <KeyRound size={22} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-neutral-900 dark:text-neutral-50">Reset your password</h1>

          {submitted ? (
            <div className="mt-4">
              <div
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                role="status"
              >
                If an account exists for <span className="font-semibold">{email}</span>, reset instructions are on
                their way. The link works for 30 minutes.
              </div>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                className="mt-4 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                Enter the email on your account. If it matches, we will send reset instructions.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmitted(true);
                }}
              >
                <div>
                  <label htmlFor="reset_email" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Email
                  </label>
                  <input
                    id="reset_email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
                >
                  Send reset link
                </button>
              </form>
            </>
          )}

          <p className="mt-5 text-center text-sm text-neutral-500 dark:text-neutral-400">
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
