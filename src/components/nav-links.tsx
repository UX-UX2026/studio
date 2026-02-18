'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  FileText,
  Repeat,
  PenLine,
  ClipboardCheck,
  Users,
  Settings,
  Building2,
} from 'lucide-react';
import {
  SidebarNav,
  SidebarNavLink,
  SidebarNavMain,
} from '@/components/app/sidebar';
import Link from 'next/link';
import { type UserRole } from '@/firebase/auth/use-user';

const allLinks = [
  { href: '/', label: 'Overview', icon: LayoutGrid, roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive'] },
  { href: '/submission', label: 'Period Submission', icon: FileText, roles: ['Administrator', 'Manager'] },
  { href: '/recurring', label: 'Recurring Items', icon: Repeat, roles: ['Administrator', 'Procurement Officer'] },
  { href: '/approvals', label: 'Approvals', icon: PenLine, roles: ['Administrator', 'Executive'] },
  { href: '/fulfillment', label: 'Fulfillment', icon: ClipboardCheck, roles: ['Administrator', 'Procurement Officer'] },
  { href: '/vendors', label: 'Vendors', icon: Building2, roles: ['Administrator', 'Procurement Officer'] },
  { href: '/users', label: 'User Management', icon: Users, roles: ['Administrator'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['Administrator'] },
];

export function NavLinks({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const visibleLinks = role ? allLinks.filter(link => link.roles.includes(role)) : [];

  return (
    <SidebarNav>
      <SidebarNavMain>
        {visibleLinks.map((link) => {
          const isActive =
            link.href === '/'
              ? pathname === '/'
              : pathname.startsWith(link.href);
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
