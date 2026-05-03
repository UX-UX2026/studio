'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Scale, Save, Banknote, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import type { AppMetadata, BudgetRules } from "@/types";
import { Separator } from "@/components/ui/separator";

export default function ProcurementRulesPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const [limitSubmissions, setLimitSubmissions] = useState(false);
    const [budgetRules, setBudgetRules] = useState<BudgetRules>({
        overSpendAllowedPercentage: 0,
        overSpendAllowedAmount: 0,
        underSpendAlertPercentage: 0,
        underSpendAlertAmount: 0
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (appMetadata) {
            setLimitSubmissions(appMetadata.limitToOneSubmissionPerPeriod || false);
            if (appMetadata.budgetRules) {
                setBudgetRules(appMetadata.budgetRules);
            }
        }
    }, [appMetadata]);

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const handleRuleChange = (field: keyof BudgetRules, value: string) => {
        setBudgetRules(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleSaveChanges = async () => {
        if (!user || !firestore) {
            toast({ variant: "destructive", title: "Save failed", description: "Required services are not available." });
            return;
        }

        setIsSaving(true);
        const action = 'procurement_rules.update';

        try {
            await setDoc(appMetadataRef, { 
                limitToOneSubmissionPerPeriod: limitSubmissions,
                budgetRules: budgetRules
            }, { merge: true });
            
            toast({ title: "Settings Saved", description: "Procurement rules and budget thresholds have been updated." });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Updated procurement rules and budget thresholds.`,
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
    
    if (userLoading || metadataLoading || !user || role !== 'Administrator') {
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
                        <Scale className="h-6 w-6 text-primary" />
                        Submission Rules
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
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Banknote className="h-6 w-6 text-primary" />
                        Budget Tolerance Rules
                    </CardTitle>
                    <CardDescription>
                        Define thresholds for over-spending and under-spending. Categories exceeding these values will be highlighted during submission.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                                Over-spend Thresholds
                            </h3>
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label>Allowed Percentage (%)</Label>
                                    <Input 
                                        type="number" 
                                        value={budgetRules.overSpendAllowedPercentage} 
                                        onChange={(e) => handleRuleChange('overSpendAllowedPercentage', e.target.value)}
                                        placeholder="e.g. 5"
                                    />
                                    <p className="text-xs text-muted-foreground text-red-400">Flag as issue if spend > budget + X%</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Allowed Amount (ZAR)</Label>
                                    <Input 
                                        type="number" 
                                        value={budgetRules.overSpendAllowedAmount} 
                                        onChange={(e) => handleRuleChange('overSpendAllowedAmount', e.target.value)}
                                        placeholder="e.g. 1000"
                                    />
                                    <p className="text-xs text-muted-foreground text-red-400">Flag as issue if spend > budget + X amount</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2 text-amber-600">
                                <AlertTriangle className="h-4 w-4" />
                                Under-spend Alerts
                            </h3>
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label>Alert Percentage (%)</Label>
                                    <Input 
                                        type="number" 
                                        value={budgetRules.underSpendAlertPercentage} 
                                        onChange={(e) => handleRuleChange('underSpendAlertPercentage', e.target.value)}
                                        placeholder="e.g. 20"
                                    />
                                    <p className="text-xs text-muted-foreground text-amber-500">Flag as warning if spend &lt; budget - X%</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Alert Amount (ZAR)</Label>
                                    <Input 
                                        type="number" 
                                        value={budgetRules.underSpendAlertAmount} 
                                        onChange={(e) => handleRuleChange('underSpendAlertAmount', e.target.value)}
                                        placeholder="e.g. 5000"
                                    />
                                    <p className="text-xs text-muted-foreground text-amber-500">Flag as warning if spend &lt; budget - X amount</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-6">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save All Rules
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
