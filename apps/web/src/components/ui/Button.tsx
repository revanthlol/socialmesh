import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-[#161a1d] text-white hover:bg-[#2b3035] active:bg-[#0b0d0e] focus-visible:outline-[#161a1d]",
      secondary:
        "bg-[#e8e6df] text-[#161a1d] hover:bg-[#dedcd3] active:bg-[#d4d1c6] focus-visible:outline-[#161a1d]",
      outline:
        "border border-[#c9c5bb] text-[#161a1d] bg-transparent hover:bg-[#e8e6df] active:bg-[#dedcd3] focus-visible:outline-[#161a1d]",
      danger:
        "bg-[#b23a24] text-white hover:bg-[#962f1c] active:bg-[#7b2414] focus-visible:outline-[#b23a24]",
      ghost:
        "text-[#4c5359] hover:text-[#161a1d] hover:bg-[#e8e6df] active:bg-[#dedcd3] focus-visible:outline-[#161a1d]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded",
      md: "h-9 px-4 text-sm rounded",
      lg: "h-11 px-5 text-base rounded",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
