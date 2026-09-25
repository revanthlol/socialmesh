import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils.js";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#161a1d] dark:focus-visible:ring-white/50 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-[#161a1d] dark:data-[state=checked]:bg-white",
        "data-[state=unchecked]:bg-[#c9c5bb] dark:data-[state=unchecked]:bg-white/20",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full shadow-sm ring-0",
          "transition-transform duration-200",
          "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
          "data-[state=checked]:bg-white dark:data-[state=checked]:bg-[#141517]",
          "data-[state=unchecked]:bg-white dark:data-[state=unchecked]:bg-white/70"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
