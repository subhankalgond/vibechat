const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
  full: 'h-24 w-24 text-2xl',
};

export default function Avatar({ user, size = 'md', showPresence = false, className = '' }) {
  const name = user ? user.full_name || user.username || '?' : '?';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      {user && user.profile_image ? (
        <img
          src={user.profile_image}
          alt={`${name}'s profile`}
          className={`${sizeClass} rounded-full object-cover`}
          loading="lazy"
        />
      ) : (
        <span
          className={`${sizeClass} flex items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/60 dark:text-primary-300`}
          aria-hidden="true"
        >
          {initials || '?'}
        </span>
      )}
      {showPresence && user && user.is_online && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-900"
          title="Online"
        />
      )}
    </span>
  );
}
