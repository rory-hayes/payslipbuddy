import type { ReactNode } from "react";
import { Heading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { Divider } from "@/components/catalyst/divider";

export function PageShell(props: { title: string; subtitle: string; actions?: ReactNode; children: ReactNode }) {
  const { title, subtitle, actions, children } = props;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Heading>{title}</Heading>
            <Text className="max-w-3xl">{subtitle}</Text>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        <Divider />
      </section>
      {children}
    </div>
  );
}
