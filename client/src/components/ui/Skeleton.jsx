export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800 ${className}`} aria-hidden="true" />;
}

export function ChatListSkeleton({ rows = 6 }) {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-end"><Skeleton className="h-10 w-52 rounded-2xl" /></div>
      <div><Skeleton className="h-10 w-40 rounded-2xl" /></div>
      <div className="flex justify-end"><Skeleton className="h-10 w-64 rounded-2xl" /></div>
      <div><Skeleton className="h-10 w-48 rounded-2xl" /></div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-md space-y-5 p-6">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}
