import { MessageCircle } from 'lucide-react';

export default function EmptyState({ icon: Icon = MessageCircle, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400">
        <Icon size={26} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
