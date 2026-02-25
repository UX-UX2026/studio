
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Shield, Trash2, Edit } from "lucide-react";
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
import { useRoles } from "@/lib/roles-provider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, query, orderBy, serverTimestamp } from "firebase/firestore";

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

    const usersQuery = useMemo(() => query(collection(firestore, 'users'), orderBy('displayName')), [firestore]);
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
    
    useEffect(() => {
        if (isDialogOpen && editingUser) {
            setName(editingUser.displayName || '');
            setEmail(editingUser.email);
            setUserRole(editingUser.role);
            setDepartment(editingUser.department);
        }
    }, [editingUser, isDialogOpen]);

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
        if (!editingUser) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Cannot create a new user from this interface. New users are created upon their first sign-in.',
            });
            setIsSaving(false);
            return;
        }

        if (!adminUser || !firestore) {
             toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'User or database service not available.',
            });
            setIsSaving(false);
            return;
        }

        const userData = {
            displayName: name,
            email,
            role: userRole,
            department,
            photoURL: editingUser.photoURL || `https://i.pravatar.cc/150?u=${email}`,
            status: editingUser.status,
        };

        try {
            const userRef = doc(firestore, 'users', editingUser.id);
            await setDoc(userRef, userData, { merge: true });
            toast({ title: "User Updated", description: "User details have been successfully updated." });
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action: 'user.update',
                details: `Updated user: ${email}`,
                entity: { type: 'user', id: editingUser.id },
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
        const userRef = doc(firestore, 'users', id);
        const deletedUser = users?.find(u => u.id === id);

        try {
            await deleteDoc(userRef);
            toast({ title: "User Deleted", description: "The user has been successfully removed." });
            if (deletedUser) {
                 await addDoc(collection(firestore, 'auditLogs'), {
                    userId: adminUser.uid,
                    userName: adminUser.displayName,
                    action: 'user.delete',
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
        }
    };

    const handleUserUpdate = async (userId: string, field: keyof UserProfile, value: any) => {
        if (!adminUser || !firestore) return;
        const userRef = doc(firestore, 'users', userId);
        const updateData = { [field]: value };
        
        try {
            await setDoc(userRef, updateData, { merge: true });
            
            if (field === 'status' && value === 'Active') {
                const user = users?.find(u => u.id === userId);
                toast({
                    title: "User Activated",
                    description: `${user?.displayName || 'The user'} has been activated.`,
                });
            }
            const user = users?.find(u => u.id === userId);
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action: `user.update.${field}`,
                details: `Updated field '${field}' to '${value}' for user ${user?.displayName || userId}`,
                entity: { type: 'user', id: userId },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("User Update Error:", error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || `Could not update the user's ${field}.`,
            });
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        User & Permission Management
                    </CardTitle>
                    <CardDescription>
                        Manage roles and departments for existing users. New users are automatically assigned a 'Requester' role upon their first sign-in.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                                                    <SelectItem value="Unassigned">Unassigned</SelectItem>
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
                                                 <Badge variant="secondary">{u.status}</Badge>
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
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Edit the user's details below.
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
                                    <SelectItem value="Unassigned">Unassigned</SelectItem>
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
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
