
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Scale, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";

type AppMetadata = {
    id: string;
    adminIsSetUp?: boolean;
    limitToOneSubmissionPerPeriod?: boolean;
}

export default function ProcurementRulesPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const [limitSubmissions, setLimitSubmissions] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (appMetadata) {
            setLimitSubmissions(appMetadata.limitToOneSubmissionPerPeriod || false);
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
        if (!user || !firestore) {
            toast({ variant: "destructive", title: "Save failed", description: "Required services are not available." });
            return;
        }

        setIsSaving(true);
        const action = 'procurement_rules.update';

        try {
            await setDoc(appMetadataRef, { limitToOneSubmissionPerPeriod: limitSubmissions }, { merge: true });
            toast({ title: "Settings Saved", description: "Procurement rules have been updated." });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Set 'limitToOneSubmissionPerPeriod' to ${limitSubmissions}.`,
                entity: { type: 'system', id: 'procurement_rules' },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Save Procurement Rules Error:", error);
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
                    <Scale className="h-6 w-6 text-primary" />
                    Procurement Rules
                </CardTitle>
                <CardDescription>
                    Set application-wide rules for how procurement submissions are handled.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="limit-submissions" className="text-base">Limit Submissions per Period</Label>
                        <p className="text-sm text-muted-foreground">
                            If enabled, users can only have one active submission per department per period.
                        </p>
                    </div>
                    <Switch
                        id="limit-submissions"
                        checked={limitSubmissions}
                        onCheckedChange={setLimitSubmissions}
                    />
                </div>
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
