
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, CalendarClock, Save, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { format, addMonths } from "date-fns";
import { logErrorToFirestore } from "@/lib/error-logger";
import { cn } from "@/lib/utils";

type Department = {
    id: string;
    name: string;
    periodSettings?: {
        [period: string]: {
            status: 'Open' | 'Locked';
        }
    };
};

export default function ProcurementPeriodsPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [periodSettings, setPeriodSettings] = useState<Department['periodSettings']>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const allowedRoles = ['Administrator'];
        if (userLoading) return;
        if (!user || !role || !allowedRoles.includes(role)) {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    useEffect(() => {
        if (!selectedDepartmentId && departments && departments.length > 0) {
            setSelectedDepartmentId(departments[0].id);
        }
    }, [departments, selectedDepartmentId]);

    useEffect(() => {
        if (selectedDepartmentId) {
            const selectedDept = departments?.find(d => d.id === selectedDepartmentId);
            setPeriodSettings(selectedDept?.periodSettings || {});
        }
    }, [selectedDepartmentId, departments]);

    const generatedPeriods = useMemo(() => {
        const periods = [];
        const now = new Date();
        for (let i = 0; i < 18; i++) {
            periods.push(format(addMonths(now, i), "MMMM yyyy"));
        }
        return periods;
    }, []);

    const handleStatusChange = (period: string, isOpen: boolean) => {
        setPeriodSettings(currentSettings => ({
            ...currentSettings,
            [period]: {
                status: isOpen ? 'Open' : 'Locked'
            }
        }));
    };

    const handleSaveChanges = async () => {
        if (!user || !firestore || !selectedDepartmentId) {
            toast({ variant: "destructive", title: "Save failed", description: "No department selected." });
            return;
        }

        setIsSaving(true);
        const action = 'procurement_periods.update';
        const departmentRef = doc(firestore, 'departments', selectedDepartmentId);

        try {
            await setDoc(departmentRef, { periodSettings }, { merge: true });
            
            toast({
                title: "Settings Saved",
                description: `Procurement period settings have been updated for ${departments?.find(d => d.id === selectedDepartmentId)?.name}.`,
            });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Updated procurement period settings.`,
                entity: { type: 'department', id: selectedDepartmentId },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            console.error("Save Period Settings Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the settings.',
            });
            await logErrorToFirestore({
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
    
    const loading = userLoading || deptsLoading;

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-6 w-6 text-primary" />
                    Procurement Period Management
                </CardTitle>
                <CardDescription>
                    Enable or disable procurement submissions for specific departments and time periods. By default, all future periods are locked.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-6 space-y-4">
                     <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="department">Department</Label>
                        <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                            <SelectTrigger id="department">
                                <SelectValue placeholder="Select a department..." />
                            </SelectTrigger>
                            <SelectContent>
                                {departments?.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedDepartmentId && (
                        <div className="p-4 border bg-amber-50 border-amber-200 rounded-lg flex items-start gap-3 text-amber-800">
                            <AlertCircle className="h-5 w-5 mt-0.5"/>
                            <div>
                                <h4 className="font-semibold">How this works</h4>
                                <p className="text-sm">
                                    When a period is set to "Open", users in that department can create and submit procurement requests for that month. When "Locked", they cannot.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {selectedDepartmentId && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {generatedPeriods.map(period => {
                                const isLocked = periodSettings?.[period]?.status !== 'Open';
                                return (
                                    <div key={period} className={cn("flex items-center justify-between rounded-lg border p-3", isLocked ? "bg-muted/50" : "bg-green-50 dark:bg-green-900/20")}>
                                        <div className="space-y-0.5">
                                            <p className="font-medium">{period}</p>
                                            <p className={cn("text-sm font-semibold", isLocked ? "text-muted-foreground" : "text-green-700 dark:text-green-400")}>
                                                {isLocked ? 'Locked' : 'Open for Submissions'}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={!isLocked}
                                            onCheckedChange={(checked) => handleStatusChange(period, checked)}
                                            aria-label={`Toggle submission status for ${period}`}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex justify-end pt-4">
                             <Button onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                        </div>
                     </div>
                )}
            </CardContent>
        </Card>
    );
}

    