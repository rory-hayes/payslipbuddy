"use client";

import {
  ArrowPathIcon,
  ChartBarIcon,
  CreditCardIcon,
  DocumentDuplicateIcon,
  HomeIcon,
  InboxStackIcon,
  SparklesIcon,
  UserGroupIcon,
  UserPlusIcon
} from "@heroicons/react/20/solid";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/catalyst/avatar";
import { Badge } from "@/components/catalyst/badge";
import { Navbar, NavbarLabel, NavbarSection, NavbarSpacer } from "@/components/catalyst/navbar";
import { SidebarLayout } from "@/components/catalyst/sidebar-layout";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer
} from "@/components/catalyst/sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<ComponentProps<"svg">>;
}

const primaryNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/payslips", label: "Payslips", icon: InboxStackIcon },
  { href: "/reports", label: "Annual Reports", icon: ChartBarIcon },
  { href: "/household", label: "Household", icon: UserGroupIcon },
  { href: "/billing", label: "Billing", icon: CreditCardIcon }
];

const secondaryNavigation: NavItem[] = [
  { href: "/onboarding", label: "Onboarding", icon: SparklesIcon },
  { href: "/budget", label: "Budget (V1.5)", icon: DocumentDuplicateIcon },
  { href: "/taxback", label: "TaxBack (V1.5)", icon: ArrowPathIcon }
];

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentLabel(pathname: string) {
  const all = [...primaryNavigation, ...secondaryNavigation];
  const current = all.find((item) => isCurrentRoute(pathname, item.href));
  return current?.label ?? "PaySlip Buddy";
}

export function ApplicationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSection>
            <Avatar square initials="PB" className="size-6 bg-zinc-900 text-white" />
            <NavbarLabel>PaySlip Buddy</NavbarLabel>
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <Badge color="blue">{currentLabel(pathname)}</Badge>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarSection>
              <SidebarItem href="/" current={pathname === "/"}>
                <Avatar square initials="PB" className="size-7 bg-zinc-900 text-white" />
                <SidebarLabel>PaySlip Buddy</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
            <SidebarSection>
              <div className="px-2">
                <Badge color="blue">Payslip OS V1</Badge>
              </div>
            </SidebarSection>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {primaryNavigation.map(({ href, label, icon: Icon }) => (
                <SidebarItem key={href} href={href} current={isCurrentRoute(pathname, href)}>
                  <Icon />
                  <SidebarLabel>{label}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSection>
              <SidebarHeading>Roadmap</SidebarHeading>
              {secondaryNavigation.map(({ href, label, icon: Icon }) => (
                <SidebarItem key={href} href={href} current={isCurrentRoute(pathname, href)}>
                  <Icon />
                  <SidebarLabel>{label}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem href="/household" current={isCurrentRoute(pathname, "/household")}>
                <UserPlusIcon />
                <SidebarLabel>Invite Household</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter className="max-lg:hidden">
            <SidebarSection>
              <SidebarItem href="/onboarding" current={isCurrentRoute(pathname, "/onboarding")}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar square initials="RH" className="size-8 bg-zinc-200 text-zinc-700" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">Workspace</span>
                    <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                      Configure profile
                    </span>
                  </span>
                </span>
              </SidebarItem>
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  );
}
