'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  FileText,
  PenLine,
  ClipboardCheck,
  Users,
  Settings,
  Building2,
  ChevronDown,
  FilePieChart,
  History,
  Banknote,
} from 'lucide-react';
import {
  SidebarNav,
  SidebarNavLink,
  SidebarNavMain,
} from '@/components/app/sidebar';
import Link from 'next/link';
import { type UserRole } from '@/firebase/auth/use-user';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { cn } from '@/lib/utils';
import React from 'react';

const allLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid, roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester', 'Procurement Assistant'] },
  { 
    label: 'Procurement', 
    icon: FileText, 
    roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester'],
    subLinks: [
      { href: '/dashboard/procurement-summary', label: 'Summary', roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive'] },
      { href: '/dashboard/submission', label: 'Period Submission', roles: ['Administrator', 'Manager', 'Requester', 'Executive'] },
      { href: '/dashboard/recurring', label: 'Recurring Items', roles: ['Administrator', 'Procurement Officer', 'Manager', 'Executive'] },
    ]
  },
  { href: '/dashboard/approvals', label: 'Approvals', icon: PenLine, roles: ['Administrator', 'Executive', 'Manager', 'Procurement Officer'] },
  { href: '/dashboard/fulfillment', label: 'Fulfillment', icon: ClipboardCheck, roles: ['Administrator', 'Procurement Officer', 'Manager', 'Executive', 'Procurement Assistant'] },
  { href: '/dashboard/reports', label: 'Reports', icon: FilePieChart, roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive'] },
  { href: '/dashboard/vendors', label: 'Vendors', icon: Building2, roles: ['Administrator', 'Procurement Officer'] },
  { href: '/dashboard/users', label: 'User Management', icon: Users, roles: ['Administrator'] },
  { 
    label: 'Settings', 
    icon: Settings, 
    roles: ['Administrator', 'Procurement Officer'],
    subLinks: [
        { href: '/dashboard/settings', label: 'General', roles: ['Administrator'] },
        { href: '/dashboard/settings/workflow', label: 'Workflow', roles: ['Administrator'] },
        { href: '/dashboard/settings/departments', label: 'Departments', roles: ['Administrator'] },
        { href: '/dashboard/settings/roles', label: 'Roles', roles: ['Administrator'] },
        { href: '/dashboard/settings/budget', label: 'Budget', roles: ['Administrator', 'Procurement Officer'] },
        { href: '/dashboard/settings/audit-log', label: 'Audit Log', roles: ['Administrator'] },
    ]
  },
];

export function NavLinks({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const visibleLinks = role ? allLinks.filter(link => link.roles.includes(role)) : [];

  return (
    <SidebarNav>
      <SidebarNavMain>
        {visibleLinks.map((link) => {
          if (link.subLinks) {
            const visibleSubLinks = link.subLinks.filter(sublink => role && sublink.roles.includes(role));
            if (visibleSubLinks.length === 0) return null;
            
            const isParentActive = visibleSubLinks.some(sublink => pathname.startsWith(sublink.href));


            return (
              <Collapsible key={link.label} defaultOpen={isParentActive}>
                <CollapsibleTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors cursor-pointer",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isParentActive && "text-sidebar-accent-foreground"
                    )}>
                      <link.icon className="h-4 w-4" />
                      {link.label}
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform [&[data-state=open]]:rotate-180" />
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 flex flex-col gap-1 pl-8">
                  {visibleSubLinks.map(subLink => {
                     const isActive = pathname === subLink.href;
                     return (
                        <SidebarNavLink key={subLink.href} href={subLink.href} active={isActive} asChild>
                            <Link href={subLink.href}>{subLink.label}</Link>
                        </SidebarNavLink>
                     )
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          }
          
          const isActive = link.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(link.href);
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
