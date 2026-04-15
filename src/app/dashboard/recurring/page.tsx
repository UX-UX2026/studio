
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { Loader, History, Plus, Upload, Download, LayoutGrid, List } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringClient } from "@/components/app/recurring-client";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { logErrorToFirestore } from "@/lib/error-logger";
import { procurementCategories } from "@/lib/procurement-categories";
import type { RecurringItem } from "@/lib/approvals-mock-data";

type Department = {
    id: string;
    name: string;
};

type BudgetItem = {
    id: string;
    departmentId: string;
    category: string;
};

export default function RecurringItemsPage() {
    const { user, role, departmentId: userDepartmentId, department: userDepartment, reportingDepartments, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('__all__');
    const [view, setView] = useState<'grid' | 'list'>('list');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const allItemsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'recurringItems'), orderBy('name'));
    }, [firestore]);
    const { data: allItems, loading: itemsLoading } = useCollection<RecurringItem>(allItemsQuery);
    
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const budgetsQuery = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'budgets');
    }, [firestore]);
    const { data: allBudgetItems, loading: budgetsLoading } = useCollection<BudgetItem>(budgetsQuery);

    useEffect(() => {
        const allowedRoles = ['Procurement Officer', 'Administrator', 'Manager', 'Executive', 'Requester'];
        if (userLoading) return;
        if (!user) {
            router.push('/dashboard');
            return;
        }
        if (role && !allowedRoles.includes(role)) {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const filteredItems = useMemo(() => {
        if (!allItems) return [];
        
        if (role === 'Administrator' || role === 'Procurement Officer') {
            if (selectedDepartmentId === '__all__') {
                return allItems;
            }
            return allItems.filter(item => item.departmentId === selectedDepartmentId);
        }

        if (role === 'Executive') {
            if (!reportingDepartments || reportingDepartments.length === 0) {
                return allItems;
            }
            return allItems.filter(item => item.departmentId && reportingDepartments.includes(item.departmentId));
        }

        if (role === 'Manager' || role === 'Requester') {
            return allItems.filter(item => item.departmentId === userDepartmentId);
        }

        return [];

    }, [allItems, role, selectedDepartmentId, userDepartmentId, reportingDepartments]);

    const derivedCategories = useMemo(() => {
        if (budgetsLoading || !allBudgetItems) return procurementCategories;
        
        let itemsToConsider = allBudgetItems;
    
        if (selectedDepartmentId !== '__all__') {
          itemsToConsider = allBudgetItems.filter(item => item.departmentId === selectedDepartmentId);
        } else {
            // For 'All', we need to consider the user's role to scope down the list if they are not an admin.
            if (role === 'Executive') {
                if (reportingDepartments && reportingDepartments.length > 0) {
                    itemsToConsider = allBudgetItems.filter(item => item.departmentId && reportingDepartments.includes(item.departmentId));
                }
            } else if (role === 'Manager' || role === 'Requester') {
                itemsToConsider = allBudgetItems.filter(item => item.departmentId === userDepartmentId);
            }
        }
        
        const categoriesFromBudget = itemsToConsider.map(item => item.category).filter(Boolean);
        const combined = new Set([...categoriesFromBudget, ...procurementCategories]); // Keep fallback
        return Array.from(combined).sort();
    }, [allBudgetItems, budgetsLoading, selectedDepartmentId, role, userDepartmentId, reportingDepartments]);

    const handleAddItem = async () => {
        let deptId: string | undefined | null = userDepartmentId;
        let deptName: string | null = userDepartment;

        if (role === 'Administrator' || role === 'Procurement Officer') {
            if (selectedDepartmentId === '__all__') {
                toast({
                    variant: 'destructive',
                    title: 'Department Not Selected',
                    description: 'Please select a specific department from the filter to add a new item.',
                });
                return;
            }
            deptId = selectedDepartmentId;
            deptName = departments?.find(d => d.id === deptId)?.name || 'Unknown';
        }

        if (!user || !firestore || !deptId || !deptName) {
            toast({
                variant: 'destructive',
                title: 'Cannot Add Item',
                description: 'Your user profile is not assigned to a department, or no department is selected.',
            });
            return;
        }
        const newItem: Omit<RecurringItem, 'id'> = {
          name: "New Item",
          category: "Uncategorized",
          amount: 0,
          expenseType: 'Operational',
          nextLoad: "TBD",
          frequency: "Monthly",
          active: true,
          departmentId: deptId,
          departmentName: deptName,
        };
        const recurringItemsCollectionRef = collection(firestore, 'recurringItems');
        const action = 'recurringItem.create';
        
        try {
            const docRef = await addDoc(recurringItemsCollectionRef, newItem);
            toast({ title: "New item added" });
            setView('list'); // Switch to list view for easier editing

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Created new recurring item: "New Item" for ${deptName}`,
                entity: { type: 'recurringItem', id: docRef.id },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            console.error("Add Recurring Item Error:", error);
            toast({
                variant: 'destructive',
                title: 'Add Failed',
                description: error.message || 'Could not add new recurring item.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!filteredItems || filteredItems.length === 0) {
            toast({ title: "No Data to Export", description: "There are no recurring items to export in the current view." });
            return;
        }

        const headers: (keyof RecurringItem)[] = ['id', 'name', 'category', 'departmentId', 'departmentName', 'frequency', 'nextLoad', 'amount', 'active'];
        const csvContent = [
            headers.join(','),
            ...filteredItems.map(item =>
                headers.map(header => `"${(item as any)[header] || ''}"`).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'recurring-items.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // This is a placeholder for a more complex import logic
        toast({ title: "Import Clicked", description: "File import functionality is under development." });
    };

    const loading = userLoading || itemsLoading || deptsLoading || budgetsLoading;
    
    if (loading || !user || !role) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const canManageAnything = ['Administrator', 'Procurement Officer', 'Manager', 'Requester'].includes(role);

    return (
        <div className="space-y-6">
           <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2 text-primary">
                    <History className="h-6 w-6" />
                    Monthly Recurring Master List
                </CardTitle>
                <CardDescription>
                    Items defined here are automatically added to every period submission. Manage items and their recurrence below.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        {canManageAnything && (
                             <Button onClick={handleAddItem} className="shadow-lg shadow-primary/20">
                                <Plus className="h-4 w-4 mr-2"/>
                                New Recurring Item
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleImportClick} disabled>
                            <Upload className="h-4 w-4 mr-2" /> Import (WIP)
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                    </div>

                    <div className="flex items-center gap-4">
                        {(role === 'Administrator' || role === 'Procurement Officer') && departments && (
                             <div className="flex items-center gap-2">
                                <Label htmlFor="department-filter">Filter by Department</Label>
                                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                    <SelectTrigger id="department-filter" className="w-[250px]">
                                        <SelectValue placeholder="Select a department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">All Departments</SelectItem>
                                        {departments.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
                           <Button variant={view === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setView('grid')} className="gap-2">
                                <LayoutGrid className="h-4 w-4"/>
                                Grid
                            </Button>
                             <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')} className="gap-2">
                                <List className="h-4 w-4"/>
                                List
                            </Button>
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <RecurringClient items={filteredItems || []} view={view} categories={derivedCategories} />
                )}
            </CardContent>
           </Card>
        </div>
      );
}
