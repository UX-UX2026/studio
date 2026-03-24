
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Shield, Trash2, Plus, ChevronDown } from "lucide-react";
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
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp, query, where, getDocs, updateDoc, orderBy } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { cn } from "@/lib/utils";
import Link from "next/link";

type UserProfile = {
    id: string;
    displayName?: string;
    email: string;
    role: string;
    department: string;
    departmentId?: string | null;
    photoURL: string;
    status: 'Active' | 'Invited';
    alternateEmail?: string;
    notificationPreference?: 'Primary' | 'Alternate' | 'Both';
    delegatedToId?: string | null;
    delegatedToName?: string;
    reportingDepartments?: string[];
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
    
    const departmentsQuery = useMemo(() => query(collection(firestore, 'departments'), orderBy('name')), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const { roles, loading: rolesLoading } = useRoles();

    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    
    // Form state for dialog
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('');
    const [newUserDepartment, setNewUserDepartment] = useState('');
    
    const { toast } = useToast();
    
    useEffect(() => {
        if (isAddUserDialogOpen) {
            // Reset form for new user
            setName('');
            setEmail('');
            setNewUserRole('');
            setNewUserDepartment('');
        }
    }, [isAddUserDialogOpen]);

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

    const handleUpdateUser = async (userId: string, field: keyof UserProfile, value: any) => {
        if (!adminUser || !firestore) {
          toast({ variant: 'destructive', title: 'Update Failed', description: 'Authentication or database service is not available.' });
          return;
        }
      
        const userToUpdate = users?.find(u => u.id === userId);
        if (!userToUpdate) return;
      
        let updateData: Partial<UserProfile> = { [field]: value };
        
        if (field === 'departmentId') {
          const selectedDept = departments?.find(d => d.id === value);
          updateData = {
            departmentId: value === 'unassigned' ? null : (selectedDept?.id || ''),
            department: value === 'unassigned' ? 'Unassigned' : (selectedDept?.name || 'Unassigned'),
          };
        } else if (field === 'delegatedToId') {
          const delegate = users?.find(u => u.id === value);
          updateData = {
            delegatedToId: value === 'none' ? null : (delegate?.id || ''),
            delegatedToName: value === 'none' ? '' : (delegate?.displayName || ''),
          };
        } else if (field === 'reportingDepartments') {
            updateData = { reportingDepartments: value };
        }
      
        const userRef = doc(firestore, 'users', userId);
        const action = 'user.quick_edit';
      
        try {
          await updateDoc(userRef, updateData);
          toast({ title: 'User Updated', description: `${userToUpdate.displayName}'s profile has been updated.` });
      
          await addDoc(collection(firestore, 'auditLogs'), {
            userId: adminUser.uid,
            userName: adminUser.displayName,
            action,
            details: `Quick-edited ${Object.keys(updateData).join(', ')} for user: ${userToUpdate.displayName}`,
            entity: { type: 'user', id: userId },
            timestamp: serverTimestamp()
          });
      
        } catch (error: any) {
          console.error("User Update Error:", error);
          toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
          await logErrorToFirestore(firestore, { userId: adminUser.uid, userName: adminUser.displayName, action, errorMessage: error.message, errorStack: error.stack });
        }
    };
      
    const handleReportingDeptsChange = async (userId: string, departmentId: string, isChecked: boolean) => {
        const userToUpdate = users?.find(u => u.id === userId);
        if (!userToUpdate) return;
    
        const currentDepts = userToUpdate.reportingDepartments || [];
        const newDepts = isChecked
            ? [...new Set([...currentDepts, departmentId])]
            : currentDepts.filter(id => id !== departmentId);
    
        await handleUpdateUser(userId, 'reportingDepartments', newDepts);
    };

    
    const handleAddUser = async () => {
        if (!adminUser || !firestore) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Authentication or database service is not available.' });
            return;
        }

        if (!name.trim() || !email.trim()) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Name and email are required.' });
            return;
        }

        const selectedDept = departments?.find(d => d.name === newUserDepartment);
        const action = 'user.create';

        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'User Exists', description: 'A user with this email address already exists.' });
                return;
            }

            const newUserData = {
                displayName: name,
                email,
                role: newUserRole || 'Requester',
                department: newUserDepartment || 'Unassigned',
                departmentId: selectedDept?.id || null,
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
            
            setIsAddUserDialogOpen(false);
        } catch(error: any) {
            logErrorToFirestore(firestore, { userId: adminUser.uid, userName: adminUser.displayName, action, errorMessage: error.message, errorStack: error.stack });
            toast({ variant: 'destructive', title: 'Invitation Failed', description: error.message });
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
                            Quickly edit user roles and departments, or click a user's name for more details.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsAddUserDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[250px]">User</TableHead>
                                    <TableHead className="w-[180px]">Role</TableHead>
                                    <TableHead className="w-[150px]">Status</TableHead>
                                    <TableHead className="w-[200px]">Department</TableHead>
                                    <TableHead className="w-[220px]">Reporting Depts</TableHead>
                                    <TableHead className="w-[200px] hidden md:table-cell">Delegated To</TableHead>
                                    <TableHead className="text-right w-[80px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users && users.map((u) => (
                                    <TableRow key={u.id} className={cn(u.role === 'Executive' && 'bg-primary/5')}>
                                        <TableCell className="font-medium flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={u.photoURL} />
                                                <AvatarFallback>{u.displayName?.charAt(0) || u.email.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <Link href={`/dashboard/users/${u.id}`} className="font-semibold text-foreground hover:underline">{u.displayName || u.email}</Link>
                                                <div className="text-xs text-muted-foreground">{u.email}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select value={u.role} onValueChange={(value) => handleUpdateUser(u.id, 'role', value)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {roles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                         <TableCell>
                                            <Select value={u.status} onValueChange={(value) => handleUpdateUser(u.id, 'status', value)}>
                                                <SelectTrigger className={cn(u.status === 'Active' ? 'text-green-800 border-green-300' : 'text-gray-600')}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Active">Active</SelectItem>
                                                    <SelectItem value="Invited">Invited</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select value={u.departmentId || 'unassigned'} onValueChange={(value) => handleUpdateUser(u.id, 'departmentId', value)}>
                                                <SelectTrigger><SelectValue placeholder="Unassigned"/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-between">
                                                        <span>{u.reportingDepartments?.length || 0} departments</span>
                                                        <ChevronDown className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="w-56">
                                                    <DropdownMenuLabel>Select Reporting Departments</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {departments?.map(dept => (
                                                        <DropdownMenuCheckboxItem
                                                            key={dept.id}
                                                            checked={u.reportingDepartments?.includes(dept.id)}
                                                            onCheckedChange={(checked) => handleReportingDeptsChange(u.id, dept.id, !!checked)}
                                                        >
                                                            {dept.name}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Select value={u.delegatedToId || 'none'} onValueChange={(value) => handleUpdateUser(u.id, 'delegatedToId', value)}>
                                                <SelectTrigger><SelectValue placeholder="Not Set"/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {users.filter(usr => usr.id !== u.id).map(delegate => (
                                                        <SelectItem key={delegate.id} value={delegate.id}>{delegate.displayName}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore, 'users', u.id))}>
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

             <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                            Fill in the details to create a new user profile. They will appear as 'Invited' until they sign in for the first time.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                         <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="role-add">Role</Label>
                            <Select value={newUserRole || ''} onValueChange={(value) => setNewUserRole(value)}>
                                <SelectTrigger id="role-add">
                                    <SelectValue placeholder="Assign a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="department-add">Primary Department</Label>
                            <Select value={newUserDepartment} onValueChange={setNewUserDepartment}>
                                <SelectTrigger id="department-add">
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
                        <Button onClick={handleAddUser}>
                            Add User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
