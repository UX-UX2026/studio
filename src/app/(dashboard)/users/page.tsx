'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Loader, Shield, Plus, Trash2, Edit, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { mockUsers as initialMockUsers } from "@/lib/users-mock-data";
import { mockDepartments } from "@/lib/departments-mock-data";
import { useRoles } from "@/lib/roles-provider";
import { useToast } from "@/hooks/use-toast";


type MockUser = typeof initialMockUsers[0];
const allDepartments = mockDepartments.map(d => d.name);

export default function UsersPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    const [users, setUsers] = useState<MockUser[]>(initialMockUsers);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<MockUser | null>(null);

    const { roles: allRoles } = useRoles();

    // Form state for dialog
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [userRole, setUserRole] = useState<UserRole>('Manager');
    const [department, setDepartment] = useState('');
    const [avatar, setAvatar] = useState('');
    
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && (!user || role !== 'Administrator')) {
            router.push('/');
        }
    }, [user, role, loading, router]);
    
    useEffect(() => {
        if (isDialogOpen) {
            if (editingUser) {
                setName(editingUser.name);
                setEmail(editingUser.email);
                setUserRole(editingUser.role as UserRole);
                setDepartment(editingUser.department);
                setAvatar(editingUser.avatar);
            } else {
                // Reset for new user
                setName('');
                setEmail('');
                setUserRole(allRoles.length > 0 ? allRoles[0].name as UserRole : 'Manager');
                setDepartment(allDepartments[0] || '');
                setAvatar('');
            }
        }
    }, [editingUser, isDialogOpen, allRoles]);

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = () => {
        const userData: MockUser = {
            id: editingUser?.id || `user-${Date.now()}`,
            name,
            email,
            role: userRole as any, // Cast because MockUser['role'] is string
            department,
            avatar: avatar || `https://i.pravatar.cc/150?u=${email}`
        };

        if (editingUser) {
            setUsers(users.map(u => u.id === userData.id ? userData : u));
        } else {
            setUsers([...users, userData]);
        }
        setEditingUser(null);
        setIsDialogOpen(false);
    };

    const handleEdit = (userToEdit: MockUser) => {
        setEditingUser(userToEdit);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        setUsers(users.filter(u => u.id !== id));
    };

    const openAddDialog = () => {
        setEditingUser(null);
        setIsDialogOpen(true);
    }

    const handleUserUpdate = (userId: string, field: keyof MockUser, value: any) => {
        setUsers(currentUsers => 
            currentUsers.map(u => u.id === userId ? { ...u, [field]: value } : u)
        );
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (users.length === 0) {
            toast({ title: "No Data to Export", description: "There are no users to export." });
            return;
        }

        const headers: (keyof MockUser)[] = ['id', 'name', 'email', 'role', 'department', 'avatar'];
        const csvContent = [
            headers.join(','),
            ...users.map(user =>
                headers.map(header => `"${(user as any)[header]}"`).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'users.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try {
                const rows = text.split('\n').filter(row => row.trim());
                if (rows.length < 2) throw new Error("CSV file must have a header and at least one data row.");

                const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
                
                const newUsers: MockUser[] = rows.slice(1).map(row => {
                    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                    let user = {} as Partial<MockUser>;
                    headers.forEach((header, index) => {
                        (user as any)[header] = values[index];
                    });

                    if (!user.name || !user.email || !user.role || !user.department) {
                        throw new Error("CSV is missing required columns: name, email, role, department.");
                    }

                    return {
                        id: user.id || `user-${Date.now()}-${Math.random()}`,
                        name: user.name,
                        email: user.email,
                        role: user.role as any,
                        department: user.department,
                        avatar: user.avatar || `https://i.pravatar.cc/150?u=${user.email}`,
                    };
                });
                
                setUsers(prev => [...prev, ...newUsers]);

                toast({ title: "Import Successful", description: `${newUsers.length} users were added.` });
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
                        <Shield className="h-6 w-6 text-primary" />
                        User & Permission Management
                    </CardTitle>
                    <CardDescription>
                        Assign roles to users to control their access. You can also add, edit, or remove users.
                        <br />
                        <span className="text-xs text-orange-500 font-medium">Note: User changes are for demonstration and not saved. Creating roles requires code changes.</span>
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
                            Add User
                        </Button>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="w-[200px]">Role</TableHead>
                                <TableHead className="w-[200px]">Department</TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={u.avatar} />
                                            <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        {u.name}
                                    </TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell>
                                        <Select value={u.role} onValueChange={(newRole) => handleUserUpdate(u.id, 'role', newRole)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Assign role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allRoles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Select value={u.department} onValueChange={(newDept) => handleUserUpdate(u.id, 'department', newDept)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Assign department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(u)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Edit' : 'Add'} User</DialogTitle>
                        <DialogDescription>
                            Fill in the details for the user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="role" className="text-right">Role</Label>
                            <Select value={userRole || ''} onValueChange={(value) => setUserRole(value as UserRole)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Assign a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allRoles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="department" className="text-right">Department</Label>
                            <Select value={department} onValueChange={setDepartment}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Assign a department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
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
