import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-[#4c5359] mb-1.5">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={`w-full p-3 rounded border bg-white text-[#161a1d] text-sm placeholder:text-[#9aa0a6] transition-colors focus:outline-none focus:ring-1 ${
            error
              ? "border-[#b23a24] focus:border-[#b23a24] focus:ring-[#b23a24]"
              : "border-[#c9c5bb] focus:border-[#161a1d] focus:ring-[#161a1d]"
          } disabled:bg-[#f2f0e9] disabled:text-[#888] disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-[#b23a24]">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-[#6b706f]">{helperText}</p>}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
