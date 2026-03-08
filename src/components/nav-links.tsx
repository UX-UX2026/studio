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
  Rocket,
  AlertTriangle,
  BrainCircuit,
  DatabaseZap,
  Banknote,
  Workflow,
  Building,
  Shield,
  CalendarClock,
  Scale,
  Recycle,
  Eraser,
  Mail,
  LifeBuoy,
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
import React, { useMemo } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
import { cn } from '@/lib/utils';
import { useRoles } from '@/lib/roles-provider';

// Define permissions required for each link.
const allLinks = [
  // A user must have the 'dashboard:view' permission to see the main dashboard.
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid, permission: 'dashboard:view' },
  { 
    label: 'Procurement', 
    icon: FileText, 
    // A user must have at least one of these permissions to see the parent menu.
    permissions: ['procurement:submit', 'procurement:summary', 'procurement:recurring'],
    subLinks: [
      { href: '/dashboard/procurement', label: 'Quick Submit', icon: Rocket, permission: 'procurement:submit', iconClass: "text-blue-500" },
      { href: '/dashboard/procurement-summary', label: 'Summary', icon: FilePieChart, permission: 'procurement:summary', iconClass: "text-orange-500" },
      { href: '/dashboard/recurring', label: 'Recurring Items', icon: History, permission: 'procurement:recurring', iconClass: "text-purple-500" },
    ]
  },
  { href: '/dashboard/approvals', label: 'Approvals', icon: PenLine, permission: 'approvals:view' },
  { href: '/dashboard/fulfillment', label: 'Fulfillment', icon: ClipboardCheck, permission: 'fulfillment:view' },
  { href: '/dashboard/reports', label: 'Reports', icon: FilePieChart, permission: 'reports:view' },
  { href: '/dashboard/vendors', label: 'Vendors', icon: Building2, permission: 'vendors:manage' },
  { href: '/dashboard/users', label: 'User Management', icon: Users, permission: 'settings:users' },
  { href: '/dashboard/help', label: 'Help', icon: LifeBuoy, permission: 'help:view' },
  { 
    label: 'Settings', 
    icon: Settings, 
    permissions: ['settings:general', 'settings:workflow', 'settings:departments', 'settings:roles', 'settings:budget', 'settings:auditlog', 'settings:errorlog', 'settings:procurement-periods', 'settings:data'],
    subLinks: [
        { href: '/dashboard/settings', label: 'General', icon: Settings, permission: 'settings:general', iconClass: "text-gray-500" },
        { href: '/dashboard/settings/workflow', label: 'Workflow', icon: Workflow, permission: 'settings:workflow', iconClass: "text-blue-500" },
        { href: '/dashboard/settings/departments', label: 'Departments', icon: Building, permission: 'settings:departments', iconClass: "text-orange-500" },
        { href: '/dashboard/settings/roles', label: 'Roles', icon: Shield, permission: 'settings:roles', iconClass: "text-purple-500" },
        { href: '/dashboard/settings/budget', label: 'Budget', icon: Banknote, permission: 'settings:budget', iconClass: "text-green-500" },
        { href: '/dashboard/settings/procurement-periods', label: 'Procurement Periods', icon: CalendarClock, permission: 'settings:procurement-periods', iconClass: "text-teal-500" },
        { href: '/dashboard/settings/procurement-rules', label: 'Procurement Rules', icon: Scale, permission: 'settings:general', iconClass: "text-rose-500" },
        { href: '/dashboard/settings/audit-log', label: 'Audit Log', icon: History, permission: 'settings:auditlog', iconClass: "text-indigo-500" },
        { href: '/dashboard/settings/recycle-bin', label: 'Recycle Bin', icon: Recycle, permission: 'settings:data', iconClass: "text-lime-600" },
        { href: '/dashboard/settings/data-management', label: 'Data Management', icon: Eraser, permission: 'settings:data', iconClass: "text-red-500" },
        { href: '/dashboard/settings/error-log', label: 'Error Log', icon: AlertTriangle, permission: 'settings:errorlog', iconClass: "text-yellow-600" },
        { href: '/dashboard/settings/database-log', label: 'Database Test', icon: DatabaseZap, permission: 'settings:errorlog', iconClass: "text-cyan-500" },
        { href: '/dashboard/settings/mailflow', label: 'Mailflow Test', icon: Mail, permission: 'settings:errorlog', iconClass: "text-pink-500" },
        { href: '/dashboard/settings/system-log', label: 'System Log', icon: BrainCircuit, permission: 'settings:errorlog', iconClass: "text-gray-500" },
    ]
  },
];

export function NavLinks({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { roles: allRolesData } = useRoles();

  const userPermissions = useMemo(() => {
    if (!role || !allRolesData) return [];
    const currentUserRole = allRolesData.find(r => r.name === role);
    return currentUserRole?.permissions || [];
  }, [role, allRolesData]);

  const hasPermission = (permission: string) => {
    if (role === 'Administrator') return true;
    // Let's grant help:view to all logged in users.
    if (permission === 'help:view') return true;
    return userPermissions.includes(permission);
  };
  
  const hasAnyPermission = (permissions: string[]) => {
    if (role === 'Administrator') return true;
    return permissions.some(p => userPermissions.includes(p));
  };

  return (
    <SidebarMenu>
      {allLinks.map((link) => {
        if (link.subLinks) {
          // Check if user has permission to see the parent link
          if (!hasAnyPermission(link.permissions || [])) {
              return null;
          }

          const visibleSubLinks = link.subLinks.filter(sublink => hasPermission(sublink.permission));
          if (visibleSubLinks.length === 0) return null;
          
          const isParentActive = visibleSubLinks.some(sublink => pathname.startsWith(sublink.href));

          if (state === 'collapsed') {
            return (
              <SidebarMenuItem key={link.label}>
                <SidebarMenuButton tooltip={link.label} isActive={isParentActive} asChild>
                    <Link href={visibleSubLinks[0].href}>
                      <link.icon />
                      <span>{link.label}</span>
                    </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <SidebarMenuItem key={link.label} className="block">
              <Collapsible defaultOpen={isParentActive}>
                <CollapsibleTrigger className="w-full" asChild>
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
                            <SidebarMenuSubButton asChild isActive={isActive}>
                                <Link href={subLink.href}>
                                  {subLink.icon && <subLink.icon className={subLink.iconClass} />}
                                  {subLink.label}
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          );
        }
        
        if (link.permission && hasPermission(link.permission)) {
            const isActive = link.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(link.href);
            return (
            <SidebarMenuItem key={link.href}>
                <SidebarMenuButton tooltip={link.label} isActive={isActive} asChild>
                    <Link href={link.href}>
                        <link.icon />
                        <span>{link.label}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            );
        }
        return null;
      })}
    </SidebarMenu>
  );
}
