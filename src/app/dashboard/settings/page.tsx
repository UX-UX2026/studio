
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader, Settings, Workflow, Building, Shield, History, AlertTriangle, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";

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
        { href: '/dashboard/settings/workflow', label: 'Approval Workflow', description: "Define the stages, roles, and permissions for the procurement approval process.", icon: Workflow },
        { href: '/dashboard/settings/departments', label: 'Departments', description: 'Manage departments, assign managers, and set budgets.', icon: Building },
        { href: '/dashboard/settings/roles', label: 'User Roles', description: 'Define and manage the roles and permissions for users in the application.', icon: Shield },
        { href: '/dashboard/settings/audit-log', label: 'Audit Log', description: 'A log of all significant write operations performed on the database.', icon: History },
        { href: '/dashboard/settings/error-log', label: 'Error Log', description: 'Review client-side errors captured from user interactions.', icon: AlertTriangle },
        { href: '/dashboard/settings/system-log', label: 'System Log', description: 'View a live feed of client-side events for diagnostics.', icon: BrainCircuit },
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
                <CardContent className="space-y-8">
                     <ThemeSwitcher />

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {settingLinks.map(link => (
                            <Card key={link.href} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-base">
                                        <link.icon className="h-5 w-5 text-muted-foreground" />
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
                     
                     <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Budget Integration</h3>
                        <p className="text-sm text-muted-foreground">
                           Import, view, and manage budget data from an external sheet.
                        </p>
                        <Button asChild>
                           <Link href="/dashboard/settings/budget">Manage Budget</Link>
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Backup & Restore</h3>
                        <p className="text-sm text-muted-foreground">
                           Project backups are managed outside of this application. You can use a version control system like Git to save your work, or ask me to revert to a previous state from our conversation history.
                        </p>
                        <div className="flex gap-2 pt-2">
                            <Button disabled>Create Manual Backup</Button>
                            <Button variant="outline" disabled>Configure Automatic Backups</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
