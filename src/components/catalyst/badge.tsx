import clsx from "clsx";

const tones = {
  slate: "bg-slate-900/5 text-slate-700",
  emerald: "bg-emerald-500/10 text-emerald-700",
  blue: "bg-blue-500/10 text-blue-700",
  amber: "bg-amber-500/15 text-amber-800",
  rose: "bg-rose-500/10 text-rose-700"
} as const;

export function Badge({
  className,
  tone = "slate",
  ...props
}: { tone?: keyof typeof tones } & React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={clsx(
        className,
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide",
        tones[tone]
      )}
    />
  );
}
