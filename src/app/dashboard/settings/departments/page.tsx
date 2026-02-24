
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader, Building, Plus, Trash2, Edit, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

type Department = {
    id: string;
    name: string;
    managerId: string | null;
    budget: number;
};

type UserProfile = {
    id: string;
    displayName: string;
    role: string;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
};

export default function DepartmentsPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const departmentsQuery = useMemo(() => query(collection(firestore, 'departments'), orderBy('name')), [firestore]);
    const { data: departments, loading: departmentsLoading } = useCollection<Department>(departmentsQuery);

    const usersQuery = useMemo(() => collection(firestore, 'users'), [firestore]);
    const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [managerId, setManagerId] = useState<string | null>(null);
    const [budget, setBudget] = useState(0);
    
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (userLoading) return;
        if (!user) {
          router.push('/dashboard');
          return;
        }
        if (role && role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);
    
    useEffect(() => {
        if (isDialogOpen) {
            if (editingDepartment) {
                setName(editingDepartment.name);
                setManagerId(editingDepartment.managerId);
                setBudget(editingDepartment.budget);
            } else {
                setName('');
                setManagerId(null);
                setBudget(0);
            }
        }
    }, [editingDepartment, isDialogOpen]);
    
    const loading = userLoading || departmentsLoading || usersLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = () => {
        setIsSaving(true);
        if (!name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Department name cannot be empty.',
            });
            setIsSaving(false);
            return;
        }

        if (!user || !firestore) {
             toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'User or database service not available.',
            });
            setIsSaving(false);
            return;
        }

        const departmentData = { name, managerId, budget };
        const action = editingDepartment ? 'department.update' : 'department.create';
        
        const promise = editingDepartment
            ? setDoc(doc(firestore, 'departments', editingDepartment.id), departmentData, { merge: true }).then(() => editingDepartment!.id)
            : addDoc(collection(firestore, 'departments'), departmentData).then(docRef => docRef.id);

        promise.then(departmentId => {
            toast({ title: editingDepartment ? "Department Updated" : "Department Created" });
            
            addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action,
                details: editingDepartment ? `Updated department: ${name}` : `Created department: ${name}`,
                entity: { type: 'department', id: departmentId },
                timestamp: serverTimestamp()
            }).catch(auditError => {
                console.error("Failed to write to audit log:", auditError);
            });
            
            setEditingDepartment(null);
            setIsDialogOpen(false);
        }).catch((error: any) => {
            console.error("Save Department Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the department. You may not have permissions.',
            });
            addDoc(collection(firestore, 'errorLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
                timestamp: serverTimestamp()
            }).catch(logError => console.error("Failed to write to error log:", logError));
        }).finally(() => {
            setIsSaving(false);
        });
    };
    
    const handleEdit = (department: Department) => {
        setEditingDepartment(department);
        setIsDialogOpen(true);
    };
    
    const handleDelete = (id: string) => {
        if (!user || !firestore) return;
        const deptToDelete = departments?.find(d => d.id === id);
        const deptRef = doc(firestore, 'departments', id);

        deleteDoc(deptRef).then(() => {
            toast({ title: "Department Deleted" });
            if (deptToDelete) {
                addDoc(collection(firestore, 'auditLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action: 'department.delete',
                    details: `Deleted department: ${deptToDelete.name}`,
                    entity: { type: 'department', id },
                    timestamp: serverTimestamp()
                }).catch(auditError => console.error("Failed to write to audit log:", auditError));
            }
        }).catch((error: any) => {
            console.error("Delete Department Error:", error);
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: error.message || 'Could not delete the department.',
            });
             addDoc(collection(firestore, 'errorLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: 'department.delete',
                errorMessage: error.message,
                errorStack: error.stack,
                timestamp: serverTimestamp()
            }).catch(logError => console.error("Failed to write to error log:", logError));
        });
    };

    const openAddDialog = () => {
        setEditingDepartment(null);
        setIsDialogOpen(true);
    }

    const managers = users?.filter(u => u.role === 'Manager' || u.role === 'Administrator') || [];

    const getManagerName = (managerId: string | null) => {
        if (!managerId) return 'Unassigned';
        return users?.find(u => u.id === managerId)?.displayName || 'Unknown';
    }

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!departments || departments.length === 0) {
            toast({ title: "No Data to Export", description: "There are no departments to export." });
            return;
        }

        const headers: (keyof Department)[] = ['id', 'name', 'managerId', 'budget'];
        const csvContent = [
            headers.join(','),
            ...departments.map(dept =>
                headers.map(header => `"${(dept as any)[header]}"`).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'departments.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firestore) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try {
                const rows = text.split('\n').filter(row => row.trim());
                if (rows.length < 2) throw new Error("CSV file must have a header and at least one data row.");

                const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
                
                const newDepts: Omit<Department, 'id'>[] = rows.slice(1).map(row => {
                    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                    let dept: any = {};
                    headers.forEach((header, index) => {
                        dept[header] = values[index];
                    });

                    if (!dept.name || !dept.budget) {
                        throw new Error("CSV is missing required columns: name, budget.");
                    }

                    return {
                        name: dept.name,
                        managerId: dept.managerId && dept.managerId !== 'null' ? dept.managerId : null,
                        budget: parseFloat(dept.budget) || 0,
                    };
                });
                
                newDepts.forEach(dept => {
                    addDoc(collection(firestore, 'departments'), dept)
                        .catch(err => console.error("Error importing department row:", err));
                });

                toast({ title: "Import Successful", description: `${newDepts.length} departments were added.` });
            } catch (error: any) {
                console.error("CSV Parsing Error:", error);
                toast({ variant: "destructive", title: "Import Failed", description: error.message || "Could not parse the CSV file." });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };


    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
            />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building className="h-6 w-6 text-primary" />
                        Department Management
                    </CardTitle>
                    <CardDescription>
                        Create, edit, and manage departments and their associated budgets and managers.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="h-4 w-4 mr-2" /> Import
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Department
                        </Button>
                    </div>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Department Name</TableHead>
                                    <TableHead>Manager</TableHead>
                                    <TableHead className="text-right">Approved Budget</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {departments && departments.map((dept) => (
                                    <TableRow key={dept.id}>
                                        <TableCell className="font-medium">{dept.name}</TableCell>
                                        <TableCell>{getManagerName(dept.managerId)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(dept.budget)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(dept)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDepartment ? 'Edit' : 'Add'} Department</DialogTitle>
                        <DialogDescription>
                            Fill in the details for the department.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="managerId" className="text-right">Manager</Label>
                            <Select value={managerId || 'unassigned'} onValueChange={value => setManagerId(value === 'unassigned' ? null : value)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Assign a manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {managers.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="budget" className="text-right">Budget (ZAR)</Label>
                            <Input id="budget" type="number" value={budget} onChange={e => setBudget(parseFloat(e.target.value) || 0)} className="col-span-3" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
