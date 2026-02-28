import clsx from "clsx";
import Link from "next/link";

export function Text({ className, ...props }: React.ComponentPropsWithoutRef<"p">) {
  return <p {...props} className={clsx(className, "text-sm/6 text-zinc-600 sm:text-sm/6")} />;
}

export function TextLink({ className, ...props }: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={clsx(
        className,
        "font-medium text-zinc-900 underline decoration-zinc-900/30 underline-offset-4 transition hover:decoration-zinc-900"
      )}
    />
  );
}

export function Strong({ className, ...props }: React.ComponentPropsWithoutRef<"strong">) {
  return <strong {...props} className={clsx(className, "font-semibold text-zinc-900")} />;
}
