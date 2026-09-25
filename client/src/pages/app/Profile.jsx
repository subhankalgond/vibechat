import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/ui/Avatar';
import { validateMediaFile, MAX_IMAGE_MB } from '../../utils/mediaValidation';
import { inputClass } from '../auth/Login';
import { formatLastSeen } from '../../utils/format';

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

export default function Profile() {
  const { user, updateProfile, updateAvatar, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || '');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  async function handleAvatarChange(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateMediaFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploading(true);
    const result = await updateAvatar(file);
    setUploading(false);
    if (result.success) {
      toast.success('Profile picture updated.');
    } else {
      toast.error(result.message);
    }
  }

  function startEditing() {
    setFullName(user.full_name);
    setUsername(user.username);
    setBio(user.bio || '');
    setFieldErrors({});
    setEditing(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;

    const errors = {};
    if (!fullName.trim()) errors.full_name = 'Full name is required.';
    if (!USERNAME_RE.test(username.trim())) {
      errors.username = 'Use 3 to 30 characters: letters, numbers, or underscore.';
    }
    if (bio.length > 200) errors.bio = 'Bio must be 200 characters or fewer.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    const result = await updateProfile({
      full_name: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
    });
    setSaving(false);

    if (result.success) {
      toast.success('Profile updated.');
      setEditing(false);
    } else if (result.errors) {
      setFieldErrors(result.errors);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Profile</h1>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar user={user} size="full" />
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary-600 text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60 dark:border-neutral-900"
              aria-label="Change profile picture"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
              aria-label="Upload profile picture"
            />
          </div>
          <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
            JPG, PNG, or WEBP. Up to {MAX_IMAGE_MB} MB.
          </p>

          <h2 className="mt-2 text-lg font-bold text-neutral-900 dark:text-neutral-100">{user.full_name}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">@{user.username}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {user.is_online ? 'Online' : formatLastSeen(user.last_seen)}
          </p>
          {user.bio && (
            <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {user.bio}
            </p>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor="edit_full_name" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Full name
              </label>
              <input
                id="edit_full_name"
                type="text"
                maxLength={80}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={inputClass}
              />
              {fieldErrors.full_name && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.full_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit_username" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">@</span>
                <input
                  id="edit_username"
                  type="text"
                  maxLength={30}
                  value={username}
                  onChange={(event) => setUsername(event.target.value.replace(/\s/g, ''))}
                  className={`${inputClass} pl-7`}
                />
              </div>
              {fieldErrors.username && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit_bio" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Bio
              </label>
              <textarea
                id="edit_bio"
                rows={3}
                maxLength={200}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className={`${inputClass} resize-none`}
                placeholder="A short introduction"
              />
              <p className="mt-1 text-right text-xs text-neutral-400 dark:text-neutral-500">{bio.length}/200</p>
              {fieldErrors.bio && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.bio}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={startEditing}
              className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              Edit profile
            </button>

            <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Account information</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500 dark:text-neutral-400">Email</dt>
                  <dd className="truncate font-medium text-neutral-800 dark:text-neutral-200">{user.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500 dark:text-neutral-400">Username</dt>
                  <dd className="font-medium text-neutral-800 dark:text-neutral-200">@{user.username}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500 dark:text-neutral-400">Joined</dt>
                  <dd className="font-medium text-neutral-800 dark:text-neutral-200">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Recently'}
                  </dd>
                </div>
              </dl>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
