
'use client';

import { useUser, type UserProfile as MainUserProfile } from "@/firebase/auth/use-user";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, User, Shield, Building, Mail, Bell, ArrowLeft, Save, ChevronDown, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, addDoc, query, orderBy, where } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRoles } from "@/lib/roles-provider";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

type Department = {
    id: string;
    name: string;
};

type AuditEvent = {
    id: string;
    action: string;
    details: string;
    timestamp: { seconds: number; nanoseconds: number; };
};

export default function UserProfilePage() {
    const params = useParams();
    const userId = params.userId as string;

    const { user: adminUser, role: adminRole, loading: adminLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userDocRef = useMemo(() => doc(firestore, 'users', userId), [firestore, userId]);
    const { data: userProfile, loading: userProfileLoading } = useDoc<MainUserProfile>(userDocRef);

    const departmentsQuery = useMemo(() => query(collection(firestore, 'departments'), orderBy('name')), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const allUsersQuery = useMemo(() => query(collection(firestore, 'users'), orderBy('displayName')), [firestore]);
    const { data: allUsers, loading: allUsersLoading } = useCollection<MainUserProfile>(allUsersQuery);
    
    const auditLogsQuery = useMemo(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'auditLogs'), 
            where('entity.id', '==', userId),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, userId]);
    const { data: auditLogs, loading: auditLogsLoading } = useCollection<AuditEvent>(auditLogsQuery);

    const { roles, loading: rolesLoading } = useRoles();
    
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<MainUserProfile>>({});
    
    useEffect(() => {
        if (userProfile) {
            setFormData(userProfile);
        }
    }, [userProfile]);

    const loading = adminLoading || userProfileLoading || deptsLoading || rolesLoading || allUsersLoading || auditLogsLoading;

    const handleFormChange = (field: keyof MainUserProfile, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleReportingDeptsChange = (departmentId: string, isChecked: boolean) => {
        const currentDepts = formData.reportingDepartments || [];
        const newDepts = isChecked
            ? [...new Set([...currentDepts, departmentId])]
            : currentDepts.filter(id => id !== departmentId);
        handleFormChange('reportingDepartments', newDepts);
    };

    const handleSaveChanges = () => {
        if (!adminUser || !firestore) return;
        setIsSaving(true);
        
        let updateData: Partial<MainUserProfile> = { ...formData };
        
        const selectedDept = departments?.find(d => d.id === updateData.departmentId);
        if (selectedDept) {
            updateData.department = selectedDept.name;
        } else {
            updateData.department = 'Unassigned';
            updateData.departmentId = null;
        }

        const delegatedUser = allUsers?.find(u => u.id === updateData.delegatedToId);
        if (delegatedUser) {
            updateData.delegatedToName = delegatedUser.displayName;
        } else {
            updateData.delegatedToName = '';
            updateData.delegatedToId = null;
        }

        if ('id' in updateData) {
            delete (updateData as { id?: string }).id;
        }

        const docRef = doc(firestore, 'users', userId);

        setDoc(docRef, updateData, { merge: true })
            .then(() => {
                toast({ title: "User Profile Saved", description: `${formData.displayName}'s profile has been updated.` });
                addDoc(collection(firestore, 'auditLogs'), {
                    userId: adminUser.uid,
                    userName: adminUser.displayName,
                    action: 'user.update_profile',
                    details: `Updated profile for user: ${formData.displayName}`,
                    entity: { type: 'user', id: userId },
                    timestamp: serverTimestamp()
                });
            })
            .catch(async (serverError: any) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: updateData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!userProfile) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p>User not found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/settings/users"><ArrowLeft /></Link>
                </Button>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={formData.photoURL} alt={formData.displayName} />
                        <AvatarFallback>{formData.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold">{formData.displayName}</h1>
                        <p className="text-muted-foreground">{formData.email}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />Core Profile</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="displayName">Display Name</Label>
                                    <Input id="displayName" value={formData.displayName || ''} onChange={e => handleFormChange('displayName', e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" type="email" value={formData.email || ''} onChange={e => handleFormChange('email', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select value={formData.status || 'Invited'} onValueChange={v => handleFormChange('status', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Invited">Invited</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Organizational Role</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="role">Role</Label>
                                    <Select value={formData.role || ''} onValueChange={v => handleFormChange('role', v)}>
                                        <SelectTrigger id="role"><SelectValue placeholder="No role assigned" /></SelectTrigger>
                                        <SelectContent>
                                            {roles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="department">Primary Department</Label>
                                    <Select value={formData.departmentId || 'unassigned'} onValueChange={v => handleFormChange('departmentId', v === 'unassigned' ? null : v)}>
                                        <SelectTrigger id="department"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                             {formData.role === 'Executive' && (
                                <div className="space-y-2 pt-2">
                                    <Label>Reporting Departments</Label>
                                    <p className="text-sm text-muted-foreground">Select which departments this Executive can approve requests for.</p>
                                    <div className="p-4 border rounded-md grid grid-cols-2 gap-4">
                                        {departments?.map(dept => (
                                            <div key={dept.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`dept-check-${dept.id}`}
                                                    checked={formData.reportingDepartments?.includes(dept.id) || false}
                                                    onCheckedChange={(checked) => handleReportingDeptsChange(dept.id, !!checked)}
                                                />
                                                <Label htmlFor={`dept-check-${dept.id}`} className="font-normal">{dept.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notification Settings</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="alternateEmail">Alternate Email</Label>
                                <Input id="alternateEmail" type="email" placeholder="notifications@example.com" value={formData.alternateEmail || ''} onChange={e => handleFormChange('alternateEmail', e.target.value)} />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="notificationPreference">Preference</Label>
                                <Select value={formData.notificationPreference || 'Primary'} onValueChange={v => handleFormChange('notificationPreference', v)}>
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
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Permissions & Delegation</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                             <div className="space-y-1.5">
                                <Label htmlFor="delegatedToId">Delegate Approval To</Label>
                                <Select value={formData.delegatedToId || 'none'} onValueChange={v => handleFormChange('delegatedToId', v === 'none' ? null : v)}>
                                    <SelectTrigger id="delegatedToId"><SelectValue placeholder="Not Set" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {allUsers?.filter(u => u.id !== userId).map(delegate => (
                                            <SelectItem key={delegate.id} value={delegate.id}>{delegate.displayName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Allows another user to approve requests on this user's behalf.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {adminRole === 'Administrator' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />User Audit Trail</CardTitle>
                        <CardDescription>A log of significant actions related to this user.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center h-24">
                                <Loader className="h-6 w-6 animate-spin" />
                            </div>
                        ) : (
                            <div className="overflow-auto rounded-lg border max-h-96">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Details</TableHead>
                                            <TableHead className="text-right">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {auditLogs && auditLogs.length > 0 ? (
                                            auditLogs.map(log => (
                                                <TableRow key={log.id}>
                                                    <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{log.details}</TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {log.timestamp ? formatDistanceToNow(new Date(log.timestamp.seconds * 1000), { addSuffix: true }) : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                    No audit events found for this user.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-end pt-4">
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
