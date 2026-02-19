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
import { useRoles } from "@/lib/roles-provider";
import type { Role } from "@/lib/roles-provider";


export default function RolesPage() {
    const { user, role: userRole, loading: userLoading } = useUser();
    const router = useRouter();

    const { roles, loading: rolesLoading, addRole, updateRole, deleteRole } = useRoles();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    
    // Form state
    const [name, setName] = useState('');

    useEffect(() => {
        if (!userLoading && (!user || userRole !== 'Administrator')) {
            router.push('/');
        }
    }, [user, userRole, userLoading, router]);
    
    useEffect(() => {
        if (isDialogOpen) {
            if (editingRole) {
                setName(editingRole.name);
            } else {
                setName('');
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
        if (!name) return;

        if (editingRole) {
            await updateRole({ ...editingRole, name });
        } else {
            await addRole({ name });
        }
        setEditingRole(null);
        setIsDialogOpen(false);
    };
    
    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setIsDialogOpen(true);
    };
    
    const handleDelete = (id: string) => {
        deleteRole(id);
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
                        Create, edit, and manage user roles. Permissions are assigned in the code.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end">
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Role
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Role Name</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-medium">{r.name}</TableCell>
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Edit' : 'Add'} Role</DialogTitle>
                        <DialogDescription>
                            Enter the name for the role.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
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
