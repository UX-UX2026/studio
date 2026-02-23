
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader, Shield, Plus, Trash2, Edit } from "lucide-react";
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
import { useRoles, type Role } from "@/lib/roles-provider";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";


const allPermissions = [
    { id: 'dashboard:view', label: 'View Main Dashboard' },
    { id: 'procurement:submit', label: 'Create & Submit Requests' },
    { id: 'procurement:summary', label: 'View Procurement Summaries' },
    { id: 'procurement:recurring', label: 'Manage Recurring Items' },
    { id: 'approvals:view', label: 'View Approval Requests' },
    { id: 'approvals:action', label: 'Approve/Reject/Query Requests' },
    { id: 'fulfillment:view', label: 'View Fulfillment Dashboard' },
    { id: 'fulfillment:manage', label: 'Manage Fulfillment Tasks' },
    { id: 'reports:view', label: 'View Reports' },
    { id: 'vendors:manage', 'label': 'Manage Vendors' },
    { id: 'settings:general', label: 'View General Settings' },
    { id: 'settings:users', label: 'Manage Users' },
    { id: 'settings:departments', label: 'Manage Departments' },
    { id: 'settings:budget', label: 'Manage Budgets' },
    { id: 'settings:roles', label: 'Manage Roles & Permissions' },
    { id: 'settings:workflow', label: 'Manage Approval Workflows' },
    { id: 'settings:auditlog', label: 'View Audit Log' },
    { id: 'settings:errorlog', label: 'View Error Log' },
];


export default function RolesPage() {
    const { user, role: userRole, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const { roles, loading: rolesLoading } = useRoles();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState<string[]>([]);

    useEffect(() => {
        if (userLoading) return;
        if (!user) {
          router.push('/dashboard');
          return;
        }
        if (userRole && userRole !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, userRole, userLoading, router]);
    
    useEffect(() => {
        if (isDialogOpen) {
            if (editingRole) {
                setName(editingRole.name);
                setPermissions(editingRole.permissions || []);
            } else {
                setName('');
                setPermissions([]);
            }
        }
    }, [editingRole, isDialogOpen]);

    if (userLoading || rolesLoading || !user || userRole !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = async () => {
        if (!name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Role name cannot be empty.',
            });
            return;
        }
        
        if (!user || !firestore) {
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'User or database service not available.',
            });
            return;
        };

        const roleData = { name, permissions };
        const action = editingRole ? 'role.update' : 'role.create';
        const details = editingRole ? `Updated role from "${editingRole.name}" to "${name}"` : `Created new role: "${name}"`;

        try {
            let roleId: string;

            if (editingRole) {
                const roleRef = doc(firestore, 'roles', editingRole.id);
                await setDoc(roleRef, roleData, { merge: true });
                roleId = editingRole.id;
                toast({ title: 'Role Updated' });
            } else {
                const rolesCollectionRef = collection(firestore, 'roles');
                const docRef = await addDoc(rolesCollectionRef, roleData);
                roleId = docRef.id;
                toast({ title: 'Role Added' });
            }

            setEditingRole(null);
            setIsDialogOpen(false);
            
            addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action,
                details,
                entity: { type: 'role', id: roleId },
                timestamp: serverTimestamp()
            }).catch(error => console.error("Failed to write to audit log:", error));

        } catch (error: any) {
            console.error("Save Role Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the role.',
            });
            try {
                await addDoc(collection(firestore, 'errorLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action,
                    errorMessage: error.message,
                    errorStack: error.stack,
                    timestamp: serverTimestamp()
                });
            } catch (logError) {
                console.error("Failed to write to error log:", logError);
            }
        }
    };
    
    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setIsDialogOpen(true);
    };
    
    const handleDelete = async (id: string) => {
        if (!user || !firestore) return;
        const roleToDelete = roles.find(r => r.id === id);
        if (!roleToDelete) return;
        
        const roleRef = doc(firestore, 'roles', id);
        try {
            await deleteDoc(roleRef);
            toast({ title: 'Role Deleted' });
            
            addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: 'role.delete',
                details: `Deleted role: "${roleToDelete.name}"`,
                entity: { type: 'role', id: id },
                timestamp: serverTimestamp()
            }).catch(error => console.error("Failed to write to audit log:", error));

        } catch (error: any) {
            console.error("Delete Role Error:", error);
            toast({
                variant: 'destructive',
                title: 'Delete Failed',
                description: error.message || 'Could not delete the role.',
            });
            try {
                 await addDoc(collection(firestore, 'errorLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action: 'role.delete',
                    errorMessage: error.message,
                    errorStack: error.stack,
                    timestamp: serverTimestamp()
                });
            } catch (logError) {
                console.error("Failed to write to error log:", logError);
            }
        }
    };

    const handlePermissionChange = (permissionId: string, isChecked: boolean | 'indeterminate') => {
        setPermissions(currentPermissions => {
            if (isChecked) {
                return [...currentPermissions, permissionId];
            } else {
                return currentPermissions.filter(p => p !== permissionId);
            }
        });
    };

    const openAddDialog = () => {
        setEditingRole(null);
        setIsDialogOpen(true);
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        Role Management
                    </CardTitle>
                    <CardDescription>
                        Create, edit, and manage user roles and their permissions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end">
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Role
                        </Button>
                    </div>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Role Name</TableHead>
                                    <TableHead>Permissions</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-medium">{r.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{r.permissions?.length || 0} permissions</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
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
                <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Edit' : 'Add'} Role</DialogTitle>
                        <DialogDescription>
                            Enter the name for the role and assign permissions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                    </div>
                    <div className="flex-1 space-y-4">
                        <Label>Permissions</Label>
                        <ScrollArea className="h-72 rounded-md border p-4">
                             <div className="grid grid-cols-2 gap-4">
                                {allPermissions.map(p => (
                                    <Label key={p.id} className="flex items-center gap-2 font-normal cursor-pointer">
                                        <Checkbox
                                            id={`perm-${p.id}`}
                                            checked={permissions.includes(p.id)}
                                            onCheckedChange={checked => handlePermissionChange(p.id, checked)}
                                        />
                                        {p.label}
                                    </Label>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="border-t pt-4">
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

