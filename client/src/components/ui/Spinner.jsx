export function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function ButtonSpinner({ size = 16 }) {
  return <Spinner size={size} className="opacity-80" />;
}
