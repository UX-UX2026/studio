
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader, Shield, Plus, Trash2, Edit, Upload, Download, Send } from "lucide-react";
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
import { useRoles, type Role } from "@/lib/roles-provider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";

type UserProfile = {
    id: string;
    displayName?: string;
    email: string;
    role: string;
    department: string;
    photoURL: string;
    status: 'Active' | 'Invited';
};

type Department = {
    id: string;
    name: string;
};


export default function UsersPage() {
    const { user: adminUser, role: adminRole, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const usersQuery = useMemo(() => collection(firestore, 'users'), [firestore]);
    const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersQuery);
    
    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const { roles, loading: rolesLoading } = useRoles();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form state for dialog
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [userRole, setUserRole] = useState('');
    const [department, setDepartment] = useState('');
    
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        if (isDialogOpen) {
            if (editingUser) {
                setName(editingUser.displayName || '');
                setEmail(editingUser.email);
                setUserRole(editingUser.role);
                setDepartment(editingUser.department);
            } else {
                // Reset for new user
                setName('');
                setEmail('');
                setUserRole(roles.length > 0 ? roles[0].name : '');
                setDepartment(departments?.[0]?.name || '');
            }
        }
    }, [editingUser, isDialogOpen, roles, departments]);

    const loading = userLoading || usersLoading || deptsLoading || rolesLoading;
    
    useEffect(() => {
      if (userLoading) {
        return;
      }
      if (!adminUser) {
        router.push('/dashboard');
        return;
      }
      if (adminRole && adminRole !== 'Administrator') {
        router.push('/dashboard');
      }
    }, [adminUser, adminRole, userLoading, router]);
    
    if (loading || !adminUser || !adminRole || adminRole !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = async () => {
        setIsSaving(true);
        const action = editingUser ? 'user.update' : 'user.create';
        try {
            if (!name.trim() || !email.trim() || !userRole) {
                toast({
                    variant: 'destructive',
                    title: 'Validation Error',
                    description: 'Name, email, and role are required.',
                });
                return;
            }

            if (!adminUser || !firestore) {
                toast({
                    variant: 'destructive',
                    title: 'Save Failed',
                    description: 'User or database service not available.',
                });
                return;
            }
            
            const userData = {
                displayName: name,
                email,
                role: userRole,
                department,
                photoURL: editingUser?.photoURL || `https://i.pravatar.cc/150?u=${email}`,
                status: editingUser ? editingUser.status : 'Invited' as const,
            };

            let userId: string;
            if (editingUser) {
                const userRef = doc(firestore, 'users', editingUser.id);
                await setDoc(userRef, userData, { merge: true });
                userId = editingUser.id;
            } else {
                const docRef = await addDoc(collection(firestore, 'users'), userData);
                userId = docRef.id;
            }
            
            if (editingUser) {
                toast({ title: "User Updated", description: "User details have been successfully updated." });
            } else {
                toast({ title: "Invitation Sent", description: `An invitation email has been simulated for ${email}.` });
            }

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
                details: editingUser ? `Updated user: ${email}` : `Invited user: ${email}`,
                entity: { type: 'user', id: userId },
                timestamp: serverTimestamp()
            });
            
            setEditingUser(null);
            setIsDialogOpen(false);
        } catch (error: any) {
            console.error("Save User Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the user profile.',
            });
            await logErrorToFirestore({
                userId: adminUser?.uid,
                userName: adminUser?.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (userToEdit: UserProfile) => {
        setEditingUser(userToEdit);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!adminUser || !firestore) return;
        
        const deletedUser = users?.find(u => u.id === id);
        const action = 'user.delete';

        try {
            const userRef = doc(firestore, 'users', id);
            await deleteDoc(userRef);
            toast({ title: "User Deleted", description: "The user has been successfully removed." });

            if (deletedUser && adminUser) {
                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: adminUser.uid,
                    userName: adminUser.displayName,
                    action,
                    details: `Deleted user: ${deletedUser.email}`,
                    entity: { type: 'user', id: id },
                    timestamp: serverTimestamp()
                });
            }
        } catch (error: any) {
             console.error("Delete User Error:", error);
             toast({
                variant: 'destructive',
                title: 'Delete Failed',
                description: error.message || 'Could not delete the user.',
            });
             await logErrorToFirestore({
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack
            });
        }
    };

    const openAddDialog = () => {
        setEditingUser(null);
        setIsDialogOpen(true);
    }

    const handleUserUpdate = async (userId: string, field: keyof UserProfile, value: any) => {
        if (!adminUser || !firestore) return;
        const action = `user.update.${field}`;
        const user = users?.find(u => u.id === userId);
        
        try {
            const userRef = doc(firestore, 'users', userId);
            await setDoc(userRef, { [field]: value }, { merge: true });
            
            toast({
                title: "User Updated",
                description: `Successfully updated ${String(field)} for ${user?.displayName || 'user'}.`,
            });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
                details: `Updated field '${String(field)}' to '${value}' for user ${user?.displayName || userId}`,
                entity: { type: 'user', id: userId },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            console.error("User Update Error:", error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || `Could not update the user's ${String(field)}.`,
            });
            await logErrorToFirestore({
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack
            });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!users || users.length === 0) {
            toast({ title: "No Data to Export", description: "There are no users to export." });
            return;
        }

        const headers = ['id', 'displayName', 'email', 'role', 'department', 'photoURL', 'status'];
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
        if (!file || !firestore) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            try {
                const rows = text.split('\n').filter(row => row.trim());
                if (rows.length < 2) throw new Error("CSV file must have a header and at least one data row.");

                const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
                
                const newUsers = rows.slice(1).map(row => {
                    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                    let user: any = {};
                    headers.forEach((header, index) => {
                        user[header] = values[index];
                    });

                    if (!user.displayName || !user.email || !user.role || !user.department) {
                        throw new Error("CSV is missing required columns: displayName, email, role, department.");
                    }

                    return {
                        displayName: user.displayName,
                        email: user.email,
                        role: user.role,
                        department: user.department,
                        photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`,
                        status: (user.status === 'Active' || user.status === 'Invited') ? user.status : 'Active',
                    };
                });
                
                for (const user of newUsers) {
                    await addDoc(collection(firestore, 'users'), user);
                }

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
                        Invite new users and manage roles and departments for existing users.
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
                            Invite User
                        </Button>
                    </div>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="w-[200px]">Role</TableHead>
                                    <TableHead className="w-[200px]">Department</TableHead>
                                    <TableHead className="w-[120px]">Status</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users && users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={u.photoURL} />
                                                <AvatarFallback>{u.displayName?.charAt(0) || u.email.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            {u.displayName || u.email}
                                        </TableCell>
                                        <TableCell>{u.email}</TableCell>
                                        <TableCell>
                                            <Select value={u.role} onValueChange={(newRole) => handleUserUpdate(u.id, 'role', newRole)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Assign role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {roles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select value={u.department} onValueChange={(newDept) => handleUserUpdate(u.id, 'department', newDept)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Assign department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            {u.status === 'Active' ? (
                                                <Badge variant={'default'} className={'bg-green-600 hover:bg-green-700'}>
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUserUpdate(u.id, 'status', 'Active')}
                                                    className="text-yellow-600 border-yellow-500 hover:bg-yellow-100 hover:text-yellow-700"
                                                >
                                                    Activate User
                                                </Button>
                                            )}
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
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Edit User' : 'Invite New User'}</DialogTitle>
                        <DialogDescription>
                            {editingUser ? "Edit the user's details below." : "An invitation link will be sent to the user to complete their registration. This is a simulation."}
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
                            <Select value={userRole || ''} onValueChange={(value) => setUserRole(value)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Assign a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
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
                                    {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            {editingUser ? 'Save Changes' : <><Send className="mr-2 h-4 w-4" /> Send Invitation</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
