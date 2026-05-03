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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        overSpendType: 'percentage',
        overSpendAllowedPercentage: 0,
        overSpendAllowedAmount: 0,
        underSpendType: 'percentage',
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

    const handleRuleValueChange = (field: keyof BudgetRules, value: string) => {
        setBudgetRules(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleTypeChange = (field: 'overSpendType' | 'underSpendType', value: 'percentage' | 'amount') => {
        setBudgetRules(prev => ({ ...prev, [field]: value }));
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
                        <div className="space-y-6">
                            <h3 className="font-semibold flex items-center gap-2 text-red-600 border-b pb-2">
                                <AlertTriangle className="h-4 w-4" />
                                Over-spend Rules
                            </h3>
                            <div className="grid gap-6">
                                <div className="space-y-2">
                                    <Label>Threshold Type</Label>
                                    <Select value={budgetRules.overSpendType} onValueChange={(v) => handleTypeChange('overSpendType', v as any)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">Percentage Based (%)</SelectItem>
                                            <SelectItem value="amount">Value Based (ZAR)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {budgetRules.overSpendType === 'percentage' ? (
                                    <div className="space-y-2">
                                        <Label>Allowed Percentage (%)</Label>
                                        <Input 
                                            type="number" 
                                            value={budgetRules.overSpendAllowedPercentage} 
                                            onChange={(e) => handleRuleValueChange('overSpendAllowedPercentage', e.target.value)}
                                            placeholder="e.g. 5"
                                        />
                                        <p className="text-xs text-muted-foreground">Flag as issue if spend &gt; budget + {budgetRules.overSpendAllowedPercentage}%</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label>Allowed Over-spend Amount (ZAR)</Label>
                                        <Input 
                                            type="number" 
                                            value={budgetRules.overSpendAllowedAmount} 
                                            onChange={(e) => handleRuleValueChange('overSpendAllowedAmount', e.target.value)}
                                            placeholder="e.g. 1000"
                                        />
                                        <p className="text-xs text-muted-foreground">Flag as issue if spend &gt; budget + R{budgetRules.overSpendAllowedAmount}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-semibold flex items-center gap-2 text-amber-600 border-b pb-2">
                                <AlertTriangle className="h-4 w-4" />
                                Under-spend Rules
                            </h3>
                            <div className="grid gap-6">
                                <div className="space-y-2">
                                    <Label>Threshold Type</Label>
                                    <Select value={budgetRules.underSpendType} onValueChange={(v) => handleTypeChange('underSpendType', v as any)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">Percentage Based (%)</SelectItem>
                                            <SelectItem value="amount">Value Based (ZAR)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {budgetRules.underSpendType === 'percentage' ? (
                                    <div className="space-y-2">
                                        <Label>Alert Percentage (%)</Label>
                                        <Input 
                                            type="number" 
                                            value={budgetRules.underSpendAlertPercentage} 
                                            onChange={(e) => handleRuleValueChange('underSpendAlertPercentage', e.target.value)}
                                            placeholder="e.g. 20"
                                        />
                                        <p className="text-xs text-muted-foreground">Flag as warning if spend &lt; budget - {budgetRules.underSpendAlertPercentage}%</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label>Alert Under-spend Amount (ZAR)</Label>
                                        <Input 
                                            type="number" 
                                            value={budgetRules.underSpendAlertAmount} 
                                            onChange={(e) => handleRuleValueChange('underSpendAlertAmount', e.target.value)}
                                            placeholder="e.g. 5000"
                                        />
                                        <p className="text-xs text-muted-foreground">Flag as warning if spend &lt; budget - R{budgetRules.underSpendAlertAmount}</p>
                                    </div>
                                )}
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
