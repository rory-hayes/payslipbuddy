import type { ReactNode } from "react";
import { Heading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";

export function PageShell(props: { title: string; subtitle: string; actions?: ReactNode; children: ReactNode }) {
  const { title, subtitle, actions, children } = props;

  return (
    <main>
      <div className="mx-auto w-full max-w-7xl px-5 py-8">
        <section className="mb-6 rounded-2xl border border-zinc-200/80 bg-white/85 p-5 shadow-sm backdrop-blur md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <Heading>{title}</Heading>
              <Text className="max-w-3xl">{subtitle}</Text>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}
