import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "primary" | "secondary" | "quiet" | "danger";

interface SharedProps {
  className?: string;
  tone?: Tone;
  children: ReactNode;
}

type ButtonProps = SharedProps &
  (
    | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, "className" | "href">)
    | ({ href?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">)
  );

const toneClasses: Record<Tone, string> = {
  primary:
    "border-transparent bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 focus-visible:outline-zinc-900",
  secondary:
    "border-zinc-300 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 focus-visible:outline-zinc-600",
  quiet: "border-transparent bg-zinc-900/5 text-zinc-800 hover:bg-zinc-900/10 focus-visible:outline-zinc-600",
  danger: "border-transparent bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:outline-red-600"
};

const baseClasses =
  "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export function Button({ className, tone = "primary", children, ...props }: ButtonProps) {
  const classes = clsx(baseClasses, toneClasses[tone], className);

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  return (
    <button {...props} className={classes}>
      {children}
    </button>
  );
}
