import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ButtonSpinner } from '../../components/ui/Spinner';
import { inputClass, BrandMark } from './Login';

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate() {
    const errors = {};
    if (!form.full_name.trim()) errors.full_name = 'Full name is required.';
    else if (form.full_name.trim().length > 80) errors.full_name = 'Full name is too long.';

    if (!form.username.trim()) errors.username = 'Username is required.';
    else if (!USERNAME_RE.test(form.username.trim())) {
      errors.username = 'Use 3 to 30 characters: letters, numbers, or underscore.';
    }

    if (!form.email.trim()) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address.';

    if (!form.password) errors.password = 'Password is required.';
    else if (form.password.length < 8) errors.password = 'Password must contain at least 8 characters.';

    if (form.confirm_password !== form.password) errors.confirm_password = 'Passwords do not match.';
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    const result = await register({
      full_name: form.full_name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      confirm_password: form.confirm_password,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success('Account created. Welcome to VibeChat.');
      navigate('/app/messages', { replace: true });
      return;
    }

    if (result.errors) {
      setFieldErrors(result.errors);
      setFormError(Object.values(result.errors)[0]);
    } else {
      setFormError(result.message);
    }
  }

  function FieldError({ name }) {
    return fieldErrors[name] ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
        {fieldErrors[name]}
      </p>
    ) : null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-950">
      <Link to="/login" className="mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">VibeChat</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Create your account</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Pick a unique username. Friends can find you with it.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                {formError}
              </div>
            )}

            <div>
              <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={form.full_name}
                onChange={(event) => setField('full_name', event.target.value)}
                className={inputClass}
                placeholder="Alex Johnson"
              />
              <FieldError name="full_name" />
            </div>

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">@</span>
                <input
                  id="username"
                  type="text"
                  autoComplete="off"
                  maxLength={30}
                  value={form.username}
                  onChange={(event) => setField('username', event.target.value.replace(/\s/g, ''))}
                  className={`${inputClass} pl-7`}
                  placeholder="alex_j"
                />
              </div>
              <FieldError name="username" />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
              <FieldError name="email" />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setField('password', event.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder="At least 8 characters"
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
              <FieldError name="password" />
            </div>

            <div>
              <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Confirm password
              </label>
              <input
                id="confirm_password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={(event) => setField('confirm_password', event.target.value)}
                className={inputClass}
                placeholder="Repeat your password"
              />
              <FieldError name="confirm_password" />
            </div>

            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              You can add a profile picture later from your profile page.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-neutral-900"
            >
              {submitting && <ButtonSpinner />}
              {submitting ? 'Creating account' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
