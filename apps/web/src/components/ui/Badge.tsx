import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  variant?: "neutral" | "draft" | "success" | "warning" | "danger" | "owner";
  size?: "sm" | "md";
}

export function Badge({ children, variant = "neutral", size = "sm" }: BadgeProps) {
  const variantStyles = {
    neutral: "bg-[#e8e6df] text-[#4c5359] border-[#c9c5bb]",
    draft: "bg-[#f4f2ec] text-[#6b706f] border-[#d4d0c5]",
    success: "bg-[#e9f2eb] text-[#24613b] border-[#c5e0cb]",
    warning: "bg-[#fdf5e6] text-[#935f11] border-[#fae2b8]",
    danger: "bg-[#fbeeed] text-[#b23a24] border-[#f4c6bf]",
    owner: "bg-[#161a1d] text-white border-[#161a1d]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
    md: "px-2.5 py-1 text-xs font-medium",
  };

  return (
    <span
      className={`inline-flex items-center rounded border font-mono ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}
