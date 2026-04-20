'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, ShieldCheck, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import type { SecuritySettings, AppMetadata } from "@/types";

export default function SecuritySettingsPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const appMetadataRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'app', 'metadata');
    }, [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(false);
    const [inactivityTimeoutMinutes, setInactivityTimeoutMinutes] = useState(30);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (appMetadata?.securitySettings) {
            setAutoLogoutEnabled(appMetadata.securitySettings.autoLogoutEnabled || false);
            setInactivityTimeoutMinutes(appMetadata.securitySettings.inactivityTimeoutMinutes || 30);
        }
    }, [appMetadata]);

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const loading = userLoading || metadataLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSaveChanges = async () => {
        if (!user || !firestore || !appMetadataRef) {
            toast({ variant: "destructive", title: "Save failed", description: "Required services are not available." });
            return;
        }

        setIsSaving(true);
        const action = 'security_settings.update';

        const newSecuritySettings: SecuritySettings = {
            autoLogoutEnabled,
            inactivityTimeoutMinutes,
        };

        try {
            await setDoc(appMetadataRef, { securitySettings: newSecuritySettings }, { merge: true });
            toast({ title: "Settings Saved", description: "Security settings have been updated." });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Updated security settings. Auto-logout: ${autoLogoutEnabled}, Timeout: ${inactivityTimeoutMinutes} mins.`,
                entity: { type: 'system', id: 'security_settings' },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Save Security Settings Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the settings.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    Security Settings
                </CardTitle>
                <CardDescription>
                    Manage application-wide security settings like automatic user logout.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="auto-logout-enabled" className="text-base">Enable Auto-Logout</Label>
                        <p className="text-sm text-muted-foreground">
                            Automatically log users out after a period of inactivity.
                        </p>
                    </div>
                    <Switch
                        id="auto-logout-enabled"
                        checked={autoLogoutEnabled}
                        onCheckedChange={setAutoLogoutEnabled}
                    />
                </div>

                {autoLogoutEnabled && (
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="inactivity-timeout" className="text-base">Inactivity Timeout</Label>
                            <p className="text-sm text-muted-foreground">
                                The duration of inactivity before a user is automatically logged out.
                            </p>
                        </div>
                         <Select value={String(inactivityTimeoutMinutes)} onValueChange={(value) => setInactivityTimeoutMinutes(Number(value))}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="15">15 minutes</SelectItem>
                                <SelectItem value="30">30 minutes</SelectItem>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="120">2 hours</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                 <div className="flex justify-end pt-4">
                     <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
