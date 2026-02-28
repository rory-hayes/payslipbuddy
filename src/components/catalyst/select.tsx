import clsx from "clsx";
import { forwardRef } from "react";

const baseClasses =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-800 focus:ring-2 focus:ring-zinc-200";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={clsx(baseClasses, className)} {...props} />;
  }
);
