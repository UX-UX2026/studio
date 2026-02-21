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
  Rocket,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { type UserRole } from '@/firebase/auth/use-user';
import React from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
import { cn } from '@/lib/utils';

const allLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid, roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester', 'Procurement Assistant'] },
  { 
    label: 'Procurement', 
    icon: FileText, 
    roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester'],
    subLinks: [
      { href: '/dashboard/procurement', label: 'Quick Submit', icon: Rocket, roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive', 'Requester'] },
      { href: '/dashboard/procurement-summary', label: 'Summary', roles: ['Administrator', 'Manager', 'Procurement Officer', 'Executive'] },
      { href: '/dashboard/submission', label: 'Submission', roles: ['Administrator', 'Manager', 'Requester', 'Executive'] },
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
  const { state } = useSidebar();

  const visibleLinks = role ? allLinks.filter(link => link.roles.includes(role)) : [];

  return (
    <SidebarMenu>
      {visibleLinks.map((link) => {
        if (link.subLinks) {
          const visibleSubLinks = link.subLinks.filter(sublink => role && sublink.roles.includes(role));
          if (visibleSubLinks.length === 0) return null;
          
          const isParentActive = visibleSubLinks.some(sublink => pathname.startsWith(sublink.href));

          if (state === 'collapsed') {
            return (
              <SidebarMenuItem key={link.label}>
                  <Link href={visibleSubLinks[0].href} legacyBehavior passHref>
                      <SidebarMenuButton tooltip={link.label} isActive={isParentActive} asChild>
                          <a><link.icon /><span>{link.label}</span></a>
                      </SidebarMenuButton>
                  </Link>
              </SidebarMenuItem>
            )
          }

          return (
            <SidebarMenuItem key={link.label} className="block">
              <Collapsible defaultOpen={isParentActive}>
                <CollapsibleTrigger className="w-full">
                  <SidebarMenuButton isActive={isParentActive} className="w-full">
                      <link.icon />
                      <span>{link.label}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform [&[data-state=open]]:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {visibleSubLinks.map(subLink => {
                        const isActive = pathname === subLink.href;
                        return (
                        <SidebarMenuSubItem key={subLink.href}>
                            <Link href={subLink.href} legacyBehavior passHref>
                                <SidebarMenuSubButton asChild isActive={isActive}>
                                    <a>
                                      {subLink.icon && <subLink.icon />}
                                      {subLink.label}
                                    </a>
                                </SidebarMenuSubButton>
                            </Link>
                        </SidebarMenuSubItem>
                        )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          );
        }
        
        const isActive = link.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(link.href);
        return (
          <SidebarMenuItem key={link.href}>
            <Link href={link.href} legacyBehavior passHref>
                <SidebarMenuButton tooltip={link.label} isActive={isActive} asChild>
                    <a>
                        <link.icon />
                        <span>{link.label}</span>
                    </a>
                </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
