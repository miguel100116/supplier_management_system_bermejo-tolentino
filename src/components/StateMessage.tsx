interface StateMessageProps {
  title: string;
  message: string;
  compact?: boolean;
}

export function StateMessage({ title, message, compact = false }: StateMessageProps) {
  return (
    <div className={`panel flex items-center justify-center text-center ${compact ? 'min-h-32' : 'min-h-72'}`}>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}
