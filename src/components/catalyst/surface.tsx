import clsx from "clsx";
import type { ReactNode } from "react";

export function Surface({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx("rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}
