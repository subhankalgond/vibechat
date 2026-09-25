export default function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1" aria-live="polite">
      <div className="flex items-center gap-1 rounded-2xl bg-white px-3.5 py-2.5 shadow-sm dark:bg-neutral-800">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:240ms]" />
      </div>
      {name && <span className="text-xs text-neutral-500 dark:text-neutral-400">{name} is typing</span>}
    </div>
  );
}
