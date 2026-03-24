
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, User, Mail, Building, Shield, Bell, Briefcase, Trash2, Save, ArrowLeft, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { collection, doc, setDoc, deleteDoc, serverTimestamp, addDoc, query, orderBy } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

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

type Role = {
    id: string;
    name: string;
};

export default function UserProfilePage() {
    const { user: adminUser, role: adminRole, loading: userLoading } = useUser();
    const router = useRouter();
    const params = useParams();
    const userId = params.userId as string;

    const firestore = useFirestore();
    const { toast } = useToast();

    const userDocRef = useMemo(() => doc(firestore, 'users', userId), [firestore, userId]);
    const { data: userProfile, loading: profileLoading, error: profileError } = useDoc<UserProfile>(userDocRef);
    
    const departmentsQuery = useMemo(() => query(collection(firestore, 'departments'), orderBy('name')), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const rolesQuery = useMemo(() => query(collection(firestore, 'roles'), orderBy('name')), [firestore]);
    const { data: roles, loading: rolesLoading } = useCollection<Role>(rolesQuery);

    const usersQuery = useMemo(() => query(collection(firestore, 'users'), orderBy('displayName')), [firestore]);
    const { data: allUsers, loading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Editable state
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [userRole, setUserRole] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [status, setStatus] = useState<'Active' | 'Invited'>('Invited');
    const [alternateEmail, setAlternateEmail] = useState('');
    const [notificationPreference, setNotificationPreference] = useState<'Primary' | 'Alternate' | 'Both'>('Primary');
    const [delegatedToId, setDelegatedToId] = useState('');
    const [reportingDepartments, setReportingDepartments] = useState<string[]>([]);
    
    useEffect(() => {
        if (userProfile) {
            setDisplayName(userProfile.displayName || '');
            setEmail(userProfile.email);
            setUserRole(userProfile.role);
            setDepartmentId(userProfile.departmentId || '');
            setStatus(userProfile.status);
            setAlternateEmail(userProfile.alternateEmail || '');
            setNotificationPreference(userProfile.notificationPreference || 'Primary');
            setDelegatedToId(userProfile.delegatedToId || '');
            setReportingDepartments(userProfile.reportingDepartments || []);
        }
    }, [userProfile]);

    useEffect(() => {
        if (userLoading) return;
        if (!adminUser || adminRole !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [adminUser, adminRole, userLoading, router]);

    const loading = userLoading || profileLoading || deptsLoading || rolesLoading || usersLoading;

    if (loading) {
        return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader className="h-8 w-8 animate-spin" /></div>;
    }

    if (!userProfile) {
        return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">User not found.</div>;
    }
    
    const handleSave = async () => {
        if (!adminUser || !firestore) return;
        setIsSaving(true);
        const action = 'user.profile_update';

        const selectedDept = departments?.find(d => d.id === departmentId);

        const updatedData = {
            displayName,
            email,
            role: userRole,
            department: selectedDept?.name || 'Unassigned',
            departmentId: selectedDept?.id || null,
            status,
            alternateEmail,
            notificationPreference,
            delegatedToId,
            delegatedToName: allUsers?.find(u => u.id === delegatedToId)?.displayName || '',
            reportingDepartments: userRole === 'Executive' ? reportingDepartments : [],
        };

        try {
            await setDoc(userDocRef, updatedData, { merge: true });
            toast({ title: "Profile Updated", description: `${displayName}'s profile has been saved.` });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid, userName: adminUser.displayName, action,
                details: `Updated profile for user: ${displayName}`,
                entity: { type: 'user', id: userId },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: error.message });
            await logErrorToFirestore(firestore, { userId: adminUser.uid, userName: adminUser.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!adminUser || !firestore) return;
        setIsDeleting(true);
        const action = 'user.delete';
        try {
            await deleteDoc(userDocRef);
            toast({ title: "User Deleted", description: "The user has been permanently removed." });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: adminUser.uid, userName: adminUser.displayName, action,
                details: `Deleted user: ${userProfile.email}`,
                entity: { type: 'user', id: userId },
                timestamp: serverTimestamp()
            });
            router.push('/dashboard/settings/users');
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Delete Failed", description: error.message });
            await logErrorToFirestore(firestore, { userId: adminUser.uid, userName: adminUser.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                 <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary">
                        <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName} />
                        <AvatarFallback className="text-2xl">{userProfile.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold">{userProfile.displayName}</h1>
                        <p className="text-muted-foreground">{userProfile.email}</p>
                    </div>
                </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Core Profile</CardTitle>
                            <CardDescription>Manage the user's primary information, role, and department.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="displayName">Display Name</Label>
                                    <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled />
                                </div>
                            </div>
                             <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="role">Role</Label>
                                    <Select value={userRole} onValueChange={setUserRole}>
                                        <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {roles?.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="department">Primary Department</Label>
                                    <Select value={departmentId} onValueChange={setDepartmentId}>
                                        <SelectTrigger id="department"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">Unassigned</SelectItem>
                                            {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-1.5">
                                    <Label htmlFor="status">Status</Label>
                                     <Select value={status} onValueChange={(v: 'Active' | 'Invited') => setStatus(v)}>
                                        <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Active"><Badge className="bg-green-500 hover:bg-green-600">Active</Badge></SelectItem>
                                            <SelectItem value="Invited"><Badge variant="secondary">Invited</Badge></SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Notification Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                             <div className="space-y-1.5">
                                <Label htmlFor="alternateEmail">Alternate Email</Label>
                                <Input id="alternateEmail" type="email" value={alternateEmail} onChange={e => setAlternateEmail(e.target.value)} placeholder="e.g., secondary@example.com" />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="notificationPreference">Notification Preference</Label>
                                <Select value={notificationPreference} onValueChange={(v: 'Primary' | 'Alternate' | 'Both') => setNotificationPreference(v)}>
                                    <SelectTrigger id="notificationPreference"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Primary">Primary Email Only</SelectItem>
                                        <SelectItem value="Alternate">Alternate Email Only</SelectItem>
                                        <SelectItem value="Both">Both Emails</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                 <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Permissions & Delegation</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {userRole === 'Executive' && (
                                <div className="space-y-1.5">
                                    <Label>Reporting Departments</Label>
                                    <p className="text-xs text-muted-foreground">Select departments this executive can approve for.</p>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between">
                                                {reportingDepartments.length} selected <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-64 max-h-60 overflow-y-auto">
                                            <DropdownMenuLabel>Select Departments</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {departments?.map(dept => (
                                                <DropdownMenuCheckboxItem
                                                    key={dept.id}
                                                    checked={reportingDepartments.includes(dept.id)}
                                                    onCheckedChange={(checked) => {
                                                        setReportingDepartments(current => checked ? [...current, dept.id] : current.filter(id => id !== dept.id))
                                                    }}
                                                >
                                                    {dept.name}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}

                             <div className="space-y-1.5">
                                <Label htmlFor="delegatedToId">Delegate Approvals To</Label>
                                <Select value={delegatedToId} onValueChange={setDelegatedToId} disabled={userRole !== 'Executive' && userRole !== 'Manager'}>
                                    <SelectTrigger id="delegatedToId"><SelectValue placeholder="No delegation" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">None (Delegation Off)</SelectItem>
                                        {allUsers?.filter(u => u.id !== userId).map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                     <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive flex items-center gap-2"><Trash2 className="h-5 w-5" /> Delete User</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">Permanently delete this user and all associated data. This action cannot be undone.</p>
                        </CardContent>
                        <CardFooter>
                             <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                Delete User Permanently
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => router.push('/dashboard/settings/users')}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
