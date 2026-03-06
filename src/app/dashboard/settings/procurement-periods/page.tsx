'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, CalendarClock, Save, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, addDoc, writeBatch } from "firebase/firestore";
import { format, addMonths } from "date-fns";
import { logErrorToFirestore } from "@/lib/error-logger";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('__all__');
    const [periodSettings, setPeriodSettings] = useState<Department['periodSettings']>({});
    const [isSaving, setIsSaving] = useState(false);
    const [displayPeriods, setDisplayPeriods] = useState<string[]>([]);
    const [isAddPeriodDialogOpen, setIsAddPeriodDialogOpen] = useState(false);
    const [newPeriod, setNewPeriod] = useState('');

    useEffect(() => {
        const allowedRoles = ['Administrator'];
        if (userLoading) return;
        if (!user || !role || !allowedRoles.includes(role)) {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const baseGeneratedPeriods = useMemo(() => {
        const periods = [];
        const now = new Date();
        for (let i = 0; i < 18; i++) {
            periods.push(format(addMonths(now, i), "MMMM yyyy"));
        }
        return periods;
    }, []);

    useEffect(() => {
        if (selectedDepartmentId === '__all__') {
            const allSettings: Department['periodSettings'] = {};
            if (departments && departments.length > 0) {
                const allPossiblePeriods = new Set(baseGeneratedPeriods);
                departments.forEach(dept => {
                    if (dept.periodSettings) {
                        Object.keys(dept.periodSettings).forEach(p => allPossiblePeriods.add(p));
                    }
                });
                
                allPossiblePeriods.forEach(period => {
                    const isAllOpen = departments.every(d => d.periodSettings?.[period]?.status === 'Open');
                    allSettings[period] = { status: isAllOpen ? 'Open' : 'Locked' };
                });
            }
            setPeriodSettings(allSettings);
        } else {
            const selectedDept = departments?.find(d => d.id === selectedDepartmentId);
            setPeriodSettings(selectedDept?.periodSettings || {});
        }
    }, [selectedDepartmentId, departments, baseGeneratedPeriods]);

    useEffect(() => {
        const allKnownPeriods = new Set(baseGeneratedPeriods);
        if (periodSettings) {
            Object.keys(periodSettings).forEach(p => allKnownPeriods.add(p));
        }
        const sortedPeriods = Array.from(allKnownPeriods).sort((a, b) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
            return dateA.getTime() - dateB.getTime();
        });
        setDisplayPeriods(sortedPeriods);
    }, [periodSettings, baseGeneratedPeriods]);

    const handleStatusChange = (period: string, isOpen: boolean) => {
        setPeriodSettings(currentSettings => ({
            ...currentSettings,
            [period]: {
                status: isOpen ? 'Open' : 'Locked'
            }
        }));
    };

    const handleAddPeriod = () => {
        const trimmedPeriod = newPeriod.trim();
        if (!trimmedPeriod) {
            toast({ variant: 'destructive', title: 'Invalid Period', description: 'Period name cannot be empty.' });
            return;
        }
        if (!/^[A-Za-z]+ [0-9]{4}$/.test(trimmedPeriod)) {
             toast({ variant: 'destructive', title: 'Invalid Format', description: 'Please use "Month YYYY" format (e.g., "January 2025").' });
             return;
        }

        setPeriodSettings(currentSettings => ({
            ...currentSettings,
            [trimmedPeriod]: { status: 'Locked' }
        }));
        
        toast({ title: 'Period Added', description: `"${trimmedPeriod}" was added as Locked. You can now enable it.`});
        setNewPeriod('');
        setIsAddPeriodDialogOpen(false);
    };

    const handleSaveChanges = async () => {
        if (!user || !firestore || !selectedDepartmentId) {
            toast({ variant: "destructive", title: "Save failed", description: "No department selected." });
            return;
        }

        setIsSaving(true);
        const action = 'procurement_periods.update';

        try {
            if (selectedDepartmentId === '__all__') {
                if (!departments) throw new Error("Department list not loaded.");

                const batch = writeBatch(firestore);
                departments.forEach(dept => {
                    const deptRef = doc(firestore, 'departments', dept.id);
                    const newDeptSettings = { ...dept.periodSettings };
                    // Apply changes from the 'All Departments' view
                    Object.entries(periodSettings).forEach(([period, setting]) => {
                        if (!newDeptSettings[period]) {
                            newDeptSettings[period] = { status: 'Locked' };
                        }
                        newDeptSettings[period].status = setting.status;
                    });
                    batch.set(deptRef, { periodSettings: newDeptSettings }, { merge: true });
                });

                await batch.commit();

                toast({
                    title: "Settings Saved",
                    description: `Procurement period settings have been updated for all departments.`,
                });
                
                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action: action,
                    details: `Updated procurement period settings for ALL departments.`,
                    entity: { type: 'system', id: 'all_departments' },
                    timestamp: serverTimestamp()
                });
            } else {
                const departmentRef = doc(firestore, 'departments', selectedDepartmentId);
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
            }
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
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="h-6 w-6 text-primary" />
                        Procurement Period Management
                    </CardTitle>
                    <CardDescription>
                        Enable or disable procurement submissions for specific departments and time periods. You can also add custom periods.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                         <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="department">Department</Label>
                            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                <SelectTrigger id="department">
                                    <SelectValue placeholder="Select a department..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All Departments</SelectItem>
                                    {departments?.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsAddPeriodDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Custom Period
                            </Button>
                            <Button onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                    {selectedDepartmentId && (
                        <div className="p-4 border bg-amber-50 border-amber-200 rounded-lg flex items-start gap-3 text-amber-800 mb-6 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                            <AlertCircle className="h-5 w-5 mt-0.5"/>
                            <div>
                                <h4 className="font-semibold">How this works</h4>
                                <p className="text-sm">
                                    When a period is set to "Open", users can create and submit requests for that month. Selecting "All Departments" applies a setting across all departments at once. By default, periods are locked.
                                </p>
                            </div>
                        </div>
                    )}

                    {selectedDepartmentId && (
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {displayPeriods.map(period => {
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
                         </div>
                    )}
                </CardContent>
            </Card>
            <Dialog open={isAddPeriodDialogOpen} onOpenChange={setIsAddPeriodDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Custom Period</DialogTitle>
                        <DialogDescription>
                            Manually add a procurement period. Enter it in "Month YYYY" format (e.g., "January 2025"). It will be added as 'Locked' by default.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="new-period" className="sr-only">New Period</Label>
                        <Input 
                            id="new-period"
                            placeholder="e.g., January 2025" 
                            value={newPeriod} 
                            onChange={(e) => setNewPeriod(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAddPeriodDialogOpen(false); setNewPeriod(''); }}>Cancel</Button>
                        <Button onClick={handleAddPeriod}>Add Period</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
