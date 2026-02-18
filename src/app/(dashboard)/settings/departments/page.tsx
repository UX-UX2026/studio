'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader, Building, Plus, Trash2, Edit } from "lucide-react";
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
import { mockDepartments as initialMockDepartments } from "@/lib/departments-mock-data";
import { mockUsers } from "@/lib/users-mock-data";

type Department = {
    id: string;
    name: string;
    managerId: string | null;
    budget: number;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
};

export default function DepartmentsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    const [departments, setDepartments] = useState<Department[]>(initialMockDepartments);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [managerId, setManagerId] = useState<string | null>(null);
    const [budget, setBudget] = useState(0);

    const managers = mockUsers.filter(u => u.role === 'Manager' || u.role === 'Administrator');

    useEffect(() => {
        if (!loading && (!user || role !== 'Administrator')) {
            router.push('/');
        }
    }, [user, role, loading, router]);
    
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

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = () => {
        const departmentData: Department = {
            id: editingDepartment?.id || `dept-${Date.now()}`,
            name,
            managerId,
            budget
        };

        if (editingDepartment) {
            setDepartments(departments.map(d => d.id === departmentData.id ? departmentData : d));
        } else {
            setDepartments([...departments, departmentData]);
        }
        setEditingDepartment(null);
        setIsDialogOpen(false);
    };
    
    const handleEdit = (department: Department) => {
        setEditingDepartment(department);
        setIsDialogOpen(true);
    };
    
    const handleDelete = (id: string) => {
        setDepartments(departments.filter(d => d.id !== id));
    };

    const openAddDialog = () => {
        setEditingDepartment(null);
        setIsDialogOpen(true);
    }

    const getManagerName = (managerId: string | null) => {
        if (!managerId) return 'Unassigned';
        return mockUsers.find(u => u.id === managerId)?.name || 'Unknown';
    }

    return (
        <>
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
                    <div className="mb-4 flex justify-end">
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Department
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
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
                                {departments.map((dept) => (
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
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
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
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}