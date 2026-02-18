'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SettingsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || role !== 'Administrator')) {
            router.push('/');
        }
    }, [user, role, loading, router]);

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-6 w-6 text-primary" />
                        Application Settings
                    </CardTitle>
                    <CardDescription>
                        Manage application-wide settings. Note: Some features require backend implementation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Approval Workflow</h3>
                        <p className="text-sm text-muted-foreground">
                            Define the stages, roles, and permissions for the procurement approval process.
                        </p>
                        <Button asChild>
                           <Link href="/settings/workflow">Manage Workflows</Link>
                        </Button>
                    </div>
                     <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Departments</h3>
                        <p className="text-sm text-muted-foreground">
                            Manage departments, assign managers, and set budgets.
                        </p>
                        <Button asChild>
                           <Link href="/settings/departments">Manage Departments</Link>
                        </Button>
                    </div>
                     <div className="space-y-2">
                        <h3 className="text-lg font-semibold">User Roles</h3>
                        <p className="text-sm text-muted-foreground">
                            Define and manage the roles and permissions for users in the application.
                        </p>
                        <Button asChild>
                           <Link href="/settings/roles">Manage Roles</Link>
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Budget Integration</h3>
                        <p className="text-sm text-muted-foreground">
                           Connect to a Google Sheet to sync approved budget data. This feature is a placeholder and requires backend development and Google API configuration.
                        </p>
                        <Button disabled>Connect to Google Sheets</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
