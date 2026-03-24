

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRoles } from "@/lib/roles-provider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp, query, where, getDocs, updateDoc } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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
    reportingDepartments?: string[];
};

type Department = {
    id: string;
    name: string;
};


export default function UsersPage() {
    const { user: adminUser, profile: adminProfile, role: adminRole, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const usersQuery = useMemo(() => query(collection(firestore, 'users'), orderBy('displayName')), [firestore]);
    const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersQuery);
    
    const departmentsQuery = useMemo(() => query(collection(firestore, 'departments'), orderBy('name')), [firestore]);
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
    const [reportingDepartments, setReportingDepartments] = useState<string[]>([]);
    
    const { toast } = useToast();
    
    useEffect(() => {
        if (isDialogOpen && editingUser) {
            setName(editingUser.displayName || '');
            setEmail(editingUser.email);
            setUserRole(editingUser.role);
            setDepartment(editingUser.department);
            setAlternateEmail(editingUser.alternateEmail || '');
            setNotificationPreference(editingUser.notificationPreference || 'Primary');
            setReportingDepartments(editingUser.reportingDepartments || []);
        } else if (isDialogOpen && !editingUser) {
            // Reset form for new user
            setName('');
            setEmail('');
            setUserRole('');
            setDepartment('');
            setAlternateEmail('');
            setNotificationPreference('Primary');
            setReportingDepartments([]);
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
        
        const baseUserData: any = {
            displayName: name,
            email,
            role: userRole,
            department: department || 'Unassigned',
            departmentId: selectedDept?.id || null,
            alternateEmail: alternateEmail,
            notificationPreference: notificationPreference,
            reportingDepartments: userRole === 'Executive' ? reportingDepartments : [],
        };

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
                    ...baseUserData,
                    photoURL: `https://i.pravatar.cc/150?u=${email}`,
                    status: 'Invited' as const,
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
            const finalUserData = {
                ...baseUserData,
                photoURL: editingUser?.photoURL || `https://i.pravatar.cc/150?u=${email}`,
                status: editingUser.status,
            };

            await setDoc(userRef, finalUserData, { merge: true });

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
    
    const getDelegateName = (user: UserProfile) => {
        if (user.delegatedToName) return user.delegatedToName;
        if (user.delegatedToId) return 'Loading...';
        return 'Not Set';
    }

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
                                    <TableHead>Primary Department</TableHead>
                                    <TableHead className="hidden sm:table-cell">Delegated To</TableHead>
                                    <TableHead className="hidden md:table-cell w-[120px]">Status</TableHead>
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
                                            <Badge variant="secondary">{u.role}</Badge>
                                        </TableCell>
                                        <TableCell>{u.department || 'Unassigned'}</TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            {getDelegateName(u)}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Badge variant={u.status === 'Active' ? 'default' : 'destructive'} className={cn(u.status === 'Active' && 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300')}>{u.status}</Badge>
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                        <DialogDescription>
                             {editingUser 
                                ? "Edit the user's details below."
                                : "Fill in the details to create a new user profile. They will appear as 'Invited' until they sign in for the first time."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                         <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!editingUser} />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="role">Role</Label>
                            <Select value={userRole || ''} onValueChange={(value) => setUserRole(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Assign a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {userRole === 'Executive' && (
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Reporting Departments</Label>
                                <div className="rounded-md border p-4 max-h-48 overflow-y-auto">
                                    <div className="space-y-2">
                                        {departments?.map(dept => (
                                            <div key={dept.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`dialog-dept-check-${dept.id}`}
                                                    checked={reportingDepartments.includes(dept.id)}
                                                    onCheckedChange={(checked) => {
                                                        const currentIds = reportingDepartments;
                                                        const newIds = checked
                                                            ? [...currentIds, dept.id]
                                                            : currentIds.filter(id => id !== dept.id);
                                                        setReportingDepartments(newIds);
                                                    }}
                                                />
                                                <Label htmlFor={`dialog-dept-check-${dept.id}`} className="font-normal">{dept.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Select the departments this executive can approve requests for.</p>
                            </div>
                        )}

                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="department">Primary Department</Label>
                            <Select value={department} onValueChange={setDepartment}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Assign a department" />
                                </SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="Unassigned">Unassigned</SelectItem>
                                    {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                         <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="alt-email">Alternate Email</Label>
                            <Input id="alt-email" type="email" value={alternateEmail} onChange={e => setAlternateEmail(e.target.value)} placeholder="optional.email@example.com" />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="notification-pref">Notify</Label>
                            <Select value={notificationPreference} onValueChange={(value: 'Primary' | 'Alternate' | 'Both') => setNotificationPreference(value)}>
                                <SelectTrigger id="notification-pref">
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

