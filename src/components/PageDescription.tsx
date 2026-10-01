interface PageDescriptionProps {
  children: string;
}

export function PageDescription({ children }: PageDescriptionProps) {
  return (
    <div className="panel px-5 py-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{children}</p>
    </div>
  );
}
