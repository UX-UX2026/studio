
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Shield, Trash2, Edit, Plus, ChevronDown } from "lucide-react";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRoles } from "@/lib/roles-provider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp, query, where, getDocs, updateDoc } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { cn } from "@/lib/utils";

type UserProfile = {
    id: string;
    displayName?: string;
    email: string;
    role: string;
    department: string;
    departmentId?: string;
    photoURL: string;
    status: 'Active' | 'Invited';
    alternateEmail?: string;
    notificationPreference?: 'Primary' | 'Alternate' | 'Both';
    delegatedToId?: string;
    delegatedToName?: string;
    approvableDepartmentIds?: string[];
};

type Department = {
    id: string;
    name: string;
};


export default function UsersPage() {
    const { user: adminUser, profile: adminProfile, role: adminRole, loading: userLoading } = useUser();
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
    const [alternateEmail, setAlternateEmail] = useState('');
    const [notificationPreference, setNotificationPreference] = useState<'Primary' | 'Alternate' | 'Both'>('Primary');
    const [approvableDepartmentIds, setApprovableDepartmentIds] = useState<string[]>([]);
    
    const { toast } = useToast();
    
    useEffect(() => {
        if (isDialogOpen && editingUser) {
            setName(editingUser.displayName || '');
            setEmail(editingUser.email);
            setUserRole(editingUser.role);
            setDepartment(editingUser.department);
            setAlternateEmail(editingUser.alternateEmail || '');
            setNotificationPreference(editingUser.notificationPreference || 'Primary');
            setApprovableDepartmentIds(editingUser.approvableDepartmentIds || []);
        } else if (isDialogOpen && !editingUser) {
            // Reset form for new user
            setName('');
            setEmail('');
            setUserRole('');
            setDepartment('');
            setAlternateEmail('');
            setNotificationPreference('Primary');
            setApprovableDepartmentIds([]);
        }
    }, [editingUser, isDialogOpen]);

    const loading = userLoading || usersLoading || deptsLoading || rolesLoading;
    
    useEffect(() => {
        if (userLoading) return;
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
        
        if (!adminUser || !firestore) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Authentication or database service is not available.' });
            setIsSaving(false);
            return;
        }

        if (!name.trim() || !email.trim() || !userRole) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Name, email, and role are required.' });
            setIsSaving(false);
            return;
        }

        const selectedDept = departments?.find(d => d.name === department);

        if (!editingUser) { // Handle "Add User"
            const action = 'user.create';
            try {
                const usersRef = collection(firestore, 'users');
                const q = query(usersRef, where("email", "==", email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    toast({ variant: 'destructive', title: 'User Exists', description: 'A user with this email address already exists.' });
                    setIsSaving(false);
                    return;
                }

                const newUserData = {
                    displayName: name,
                    email,
                    role: userRole,
                    department,
                    departmentId: selectedDept?.id || null,
                    photoURL: `https://i.pravatar.cc/150?u=${email}`,
                    status: 'Invited' as const,
                    alternateEmail: alternateEmail,
                    notificationPreference: notificationPreference,
                    approvableDepartmentIds: userRole === 'Executive' ? approvableDepartmentIds : [],
                };
                const docRef = await addDoc(usersRef, newUserData);
                toast({ title: "User Invited", description: "User profile created. They must sign in to activate." });

                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: adminUser.uid,
                    userName: adminUser.displayName,
                    action,
                    details: `Invited new user: ${email}`,
                    entity: { type: 'user', id: docRef.id },
                    timestamp: serverTimestamp()
                });
                
                setIsDialogOpen(false);
            } catch(error: any) {
                logErrorToFirestore(firestore, { userId: adminUser.uid, userName: adminUser.displayName, action, errorMessage: error.message, errorStack: error.stack });
                toast({ variant: 'destructive', title: 'Invitation Failed', description: error.message });
            } finally {
                setIsSaving(false);
            }
            return;
        }
        
        // Handle "Edit User"
        const action = 'user.update';
        try {
            const userRef = doc(firestore, 'users', editingUser.id);
            
            const userData = {
                displayName: name,
                email,
                role: userRole,
                department,
                departmentId: selectedDept?.id || null,
                photoURL: editingUser?.photoURL || `https://i.pravatar.cc/150?u=${email}`,
                status: editingUser.status,
                alternateEmail: alternateEmail,
                notificationPreference: notificationPreference,
                approvableDepartmentIds: userRole === 'Executive' ? approvableDepartmentIds : [],
            };
            await setDoc(userRef, userData, { merge: true });

            toast({ title: "User Updated", description: "User details have been successfully updated." });

            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
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
            await logErrorToFirestore(firestore, {
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
             await logErrorToFirestore(firestore, {
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
    };

    const handleUserUpdate = async (userId: string, field: keyof UserProfile, value: any) => {
        if (!adminUser || !firestore) return;
        const action = `user.update.${field}`;
        const user = users?.find(u => u.id === userId);
        
        try {
            const userRef = doc(firestore, 'users', userId);
            
            const updatePayload: Partial<UserProfile> = { [field]: value };

            if (field === 'department') {
                const selectedDept = departments?.find(d => d.name === value);
                updatePayload.departmentId = selectedDept?.id || null;
            }

            await setDoc(userRef, updatePayload, { merge: true });
            
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
            await logErrorToFirestore(firestore, {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack
            });
        }
    };
    
    const handleUpdateDelegate = async (executiveUserId: string, delegateId: string) => {
        if (!adminUser || !firestore || !users) return;
    
        const delegateUser = users.find(u => u.id === delegateId);
        const delegateName = delegateUser ? delegateUser.displayName : '';
        const executiveUser = users.find(u => u.id === executiveUserId);
    
        const action = 'user.update.delegation';
        
        try {
            const userRef = doc(firestore, 'users', executiveUserId);
            await setDoc(userRef, { delegatedToId: delegateId, delegatedToName: delegateName }, { merge: true });
            
            toast({
                title: "Delegate Updated",
                description: `${executiveUser?.displayName}'s approvals have been delegated to ${delegateName || 'no one'}.`,
            });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
                details: `Updated delegate for ${executiveUser?.displayName} to ${delegateName || 'none'}`,
                entity: { type: 'user', id: executiveUserId },
                timestamp: serverTimestamp()
            });
    
        } catch (error: any) {
            console.error("Delegate Update Error:", error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || `Could not update delegate.`,
            });
             await logErrorToFirestore(firestore, {
                userId: adminUser.uid,
                userName: adminUser.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-6 w-6 text-primary" />
                            User & Permission Management
                        </CardTitle>
                        <CardDescription>
                            Manage roles, departments, and delegation for all users in the system.
                        </CardDescription>
                    </div>
                    <Button onClick={openAddDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Delegated To</TableHead>
                                    <TableHead>Approvable Depts</TableHead>
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
                                            <div>
                                                <div>{u.displayName || u.email}</div>
                                                <div className="text-xs text-muted-foreground">{u.email}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select value={u.role} onValueChange={(newRole) => handleUserUpdate(u.id, 'role', newRole)}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Assign role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {roles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select value={u.department} onValueChange={(newDept) => handleUserUpdate(u.id, 'department', newDept)}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Assign department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                     <SelectItem value="Unassigned">Unassigned</SelectItem>
                                                    {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            {u.role === 'Executive' ? (
                                                <Select
                                                    value={u.delegatedToId || 'none'}
                                                    onValueChange={(newDelegateId) => handleUpdateDelegate(u.id, newDelegateId === 'none' ? '' : newDelegateId)}
                                                >
                                                    <SelectTrigger className="w-[220px]">
                                                        <SelectValue placeholder="Delegate approvals..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None (Delegation Off)</SelectItem>
                                                        {users.filter(delegate => delegate.id !== u.id).map(delegate => (
                                                            <SelectItem key={delegate.id} value={delegate.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-6 w-6">
                                                                        <AvatarImage src={delegate.photoURL} />
                                                                        <AvatarFallback>{delegate.displayName?.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                    {delegate.displayName}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className="text-muted-foreground ml-3">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {u.role === 'Executive' ? (
                                                <div className="flex flex-wrap gap-1 w-40">
                                                    {(u.approvableDepartmentIds && u.approvableDepartmentIds.length > 0) ? u.approvableDepartmentIds.map(id => {
                                                        const deptName = departments?.find(d => d.id === id)?.name;
                                                        return <Badge key={id} variant="secondary" className="text-xs">{deptName || 'Unknown'}</Badge>
                                                    }) : <Badge variant="outline">All Depts</Badge>}
                                                </div>
                                            ) : <span className="text-muted-foreground ml-3">N/A</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Select value={u.status || 'Invited'} onValueChange={(newStatus) => handleUserUpdate(u.id, 'status', newStatus)}>
                                                <SelectTrigger className={cn(
                                                    "w-[120px] font-semibold border-none focus:ring-0",
                                                    u.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                )}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Active">Active</SelectItem>
                                                    <SelectItem value="Invited">Invited</SelectItem>
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
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                        <DialogDescription>
                             {editingUser 
                                ? "Edit the user's details below."
                                : "Fill in the details to create a new user profile. They will appear as 'Invited' until they sign in for the first time."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="col-span-3" required disabled={!!editingUser} />
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
                         {userRole === 'Executive' && (
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">Approvable<br/>Depts</Label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="col-span-3 text-left font-normal justify-between">
                                            <span>{approvableDepartmentIds.length > 0 ? `${approvableDepartmentIds.length} selected` : "All Departments"}</span>
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56">
                                        <DropdownMenuLabel>Approvable Departments</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {departments?.map(dept => (
                                            <DropdownMenuCheckboxItem
                                                key={dept.id}
                                                checked={approvableDepartmentIds.includes(dept.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setApprovableDepartmentIds(prev => [...prev, dept.id]);
                                                    } else {
                                                        setApprovableDepartmentIds(prev => prev.filter(id => id !== dept.id));
                                                    }
                                                }}
                                            >
                                                {dept.name}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
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
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="alt-email" className="text-right">Alt. Email</Label>
                            <Input id="alt-email" type="email" value={alternateEmail} onChange={e => setAlternateEmail(e.target.value)} className="col-span-3" placeholder="optional.email@example.com" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="notification-pref" className="text-right">Notify</Label>
                            <Select value={notificationPreference} onValueChange={(value: 'Primary' | 'Alternate' | 'Both') => setNotificationPreference(value)}>
                                <SelectTrigger id="notification-pref" className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Primary">Primary Email Only</SelectItem>
                                    <SelectItem value="Alternate">Alternate Email Only</SelectItem>
                                    <SelectItem value="Both">Both Emails</SelectItem>
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
        </div>
    );
}
