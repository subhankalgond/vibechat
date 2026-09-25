export default function BrandMark({ size = 36 }) {
  return (
    <span
      className="flex items-center justify-center rounded-xl bg-primary-600 text-white"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M9 11.5A3.5 3.5 0 0 1 12.5 8h7A3.5 3.5 0 0 1 23 11.5v5a3.5 3.5 0 0 1-3.5 3.5H14l-4.2 3.4c-.5.4-1.3 0-1.3-.7V11.5z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
