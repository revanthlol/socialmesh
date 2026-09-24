import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded border border-dashed border-[#c9c5bb] bg-[#faf9f5]">
      {icon && <div className="text-[#6b706f] mb-3">{icon}</div>}
      <h3 className="text-base font-semibold text-[#161a1d]">{title}</h3>
      <p className="mt-1 text-sm text-[#6b706f] max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
