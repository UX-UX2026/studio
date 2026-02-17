"use client";

import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  Repeat,
  PenLine,
  ClipboardCheck,
  Settings,
} from "lucide-react";
import {
  SidebarNav,
  SidebarNavLink,
  SidebarNavMain,
} from "@/components/app/sidebar";
import Link from "next/link";

const links = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/submission", label: "Period Submission", icon: FileText },
  { href: "/recurring", label: "Recurring Items", icon: Repeat },
  { href: "/approvals", label: "Approvals", icon: PenLine },
  { href: "/fulfillment", label: "Fulfillment", icon: ClipboardCheck },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <SidebarNav>
      <SidebarNavMain>
        {links.map((link) => {
          const isActive =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <SidebarNavLink
              key={link.href}
              href={link.href}
              active={isActive}
              asChild
            >
              <Link href={link.href}>
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            </SidebarNavLink>
          );
        })}
      </SidebarNavMain>
    </SidebarNav>
  );
}
