import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ApplicationLayout } from "@/components/application-layout";

export const metadata: Metadata = {
  title: {
    template: "%s - PaySlip Buddy",
    default: "PaySlip Buddy"
  },
  description: "Understand your payslip and generate annual income and deductions reports."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className="text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950"
    >
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        <ApplicationLayout>{children}</ApplicationLayout>
      </body>
    </html>
  );
}
