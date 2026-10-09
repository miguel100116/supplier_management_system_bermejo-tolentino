interface PageDescriptionProps {
  children: string;
}

export function PageDescription({ children }: PageDescriptionProps) {
  return <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{children}</p>;
}
