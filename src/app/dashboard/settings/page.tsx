
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader, Settings, Workflow, Building, Shield, History, AlertTriangle, BrainCircuit, DatabaseZap, Banknote, CalendarClock, Eraser, Recycle, Scale, HardDriveDownload, Mail, Layers, Briefcase, Users2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";
import { FontSwitcher } from "@/components/font-switcher";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!user) {
          router.push('/dashboard');
          return;
        }
        if (role && role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, loading, router]);

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const settingLinks = [
        { href: '/dashboard/settings/workflow', label: 'Approval Workflow', description: "Define the stages, roles, and permissions for the procurement approval process.", icon: Workflow, iconClass: "text-blue-500" },
        { href: '/dashboard/settings/departments', label: 'Departments', description: 'Manage departments, assign managers, and set budgets.', icon: Building, iconClass: "text-orange-500" },
        { href: '/dashboard/settings/companies', label: 'Companies', description: 'Manage the companies or legal entities in your organization.', icon: Briefcase, iconClass: "text-green-500" },
        { href: '/dashboard/settings/roles', label: 'User Roles', description: 'Define and manage the roles and permissions for users in the application.', icon: Shield, iconClass: "text-purple-500" },
        { href: '/dashboard/settings/approval-groups', label: 'Approval Groups', description: 'Create groups of users that can collectively approve requests.', icon: Users2, iconClass: "text-cyan-500" },
        { href: '/dashboard/settings/budget', label: 'Budget Integration', description: 'Import, view, and manage budget data from an external sheet.', icon: Banknote, iconClass: "text-green-500" },
        { href: '/dashboard/settings/integrations', label: 'Integrations', description: 'Connect to external accounting platforms like Odoo.', icon: Layers, iconClass: "text-violet-500" },
        { href: '/dashboard/settings/email', label: 'Email & Notifications', description: 'Configure email settings and templates.', icon: Mail, iconClass: "text-pink-500" },
        { href: '/dashboard/settings/procurement-periods', label: 'Procurement Periods', description: 'Lock and unlock submission periods for each department.', icon: CalendarClock, iconClass: "text-teal-500" },
        { href: '/dashboard/settings/procurement-rules', label: 'Procurement Rules', description: 'Set application-wide rules for procurement submissions.', icon: Scale, iconClass: "text-rose-500" },
        { href: '/dashboard/settings/security', label: 'Security', description: 'Manage session timeouts and other security policies.', icon: ShieldCheck, iconClass: "text-red-500" },
        { href: '/dashboard/settings/audit-log', label: 'Audit Log', description: 'A log of all significant write operations performed on the database.', icon: History, iconClass: "text-indigo-500" },
        { href: '/dashboard/settings/recycle-bin', label: 'Recycle Bin', description: 'Restore or permanently delete archived procurement requests.', icon: Recycle, iconClass: "text-lime-600" },
        { href: '/dashboard/settings/data-management', label: 'Backup & Data', description: 'Export all submissions or perform destructive data operations.', icon: HardDriveDownload, iconClass: "text-red-500" },
        { href: '/dashboard/settings/error-log', label: 'Error Log', description: 'Review client-side errors captured from user interactions.', icon: AlertTriangle, iconClass: "text-yellow-600" },
        { href: '/dashboard/settings/database-log', label: 'Database Test', description: 'Run a direct write test to verify the connection to Firestore.', icon: DatabaseZap, iconClass: "text-cyan-500" },
        { href: '/dashboard/settings/system-log', label: 'System Log', description: 'View a live feed of client-side application events for diagnostics.', icon: BrainCircuit, iconClass: "text-gray-500" },
    ]

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-6 w-6 text-primary" />
                        Application Settings
                    </CardTitle>
                    <CardDescription>
                        Manage application-wide settings, configurations, and user access.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <ThemeSwitcher />
                       <FontSwitcher />
                     </div>
                     
                     <Separator />

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {settingLinks.map(link => (
                            <Card key={link.href} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-base">
                                        <link.icon className={cn("h-5 w-5", link.iconClass)} />
                                        {link.label}
                                    </CardTitle>
                                    <CardDescription className="!mt-3">{link.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow" />
                                <div className="p-6 pt-0">
                                    <Button asChild className="w-full">
                                        <Link href={link.href}>Manage {link.label.split(' ')[0]}</Link>
                                    </Button>
                                </div>
                            </Card>
                        ))}
                     </div>
                </CardContent>
            </Card>
        </div>
    );
}
