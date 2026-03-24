

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
    
    // Form state for dialog
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [userRole, setUserRole] = useState('');
    const [department, setDepartment] = useState('');
    
    const { toast } = useToast();
    
    useEffect(() => {
        if (isDialogOpen) {
            // Reset form for new user
            setName('');
            setEmail('');
            setUserRole('');
            setDepartment('');
        }
    }, [isDialogOpen]);

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
    
    const handleAddUser = async () => {
        if (!adminUser || !firestore) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Authentication or database service is not available.' });
            return;
        }

        if (!name.trim() || !email.trim()) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Name and email are required.' });
            return;
        }

        const selectedDept = departments?.find(d => d.name === department);
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
                role: userRole || 'Requester',
                department: department || 'Unassigned',
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
            
            setIsDialogOpen(false);
        } catch(error: any) {
            logErrorToFirestore(firestore, { userId: adminUser.uid, userName: adminUser.displayName, action, errorMessage: error.message, errorStack: error.stack });
            toast({ variant: 'destructive', title: 'Invitation Failed', description: error.message });
        }
    };
    
    const openAddDialog = () => {
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
                            View and manage all users in the system. Click a user's name to view and edit their full profile.
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
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden lg:table-cell">Delegated To</TableHead>
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
                                                <Link href={`/dashboard/users/${u.id}`} className="hover:underline font-semibold text-primary">
                                                    {u.displayName || u.email}
                                                </Link>
                                                <div className="text-xs text-muted-foreground">{u.email}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{u.role}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {u.department}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn(u.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300')}>
                                                {u.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            {getDelegateName(u)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                            <Select value={userRole || ''} onValueChange={(value) => setUserRole(value)}>
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
                            <Select value={department} onValueChange={setDepartment}>
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
