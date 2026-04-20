'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Users2, Plus, Trash2, Edit, ChevronDown } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ApprovalGroup, UserProfileData } from "@/types";

export default function ApprovalGroupsPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const groupsQuery = useMemo(() => query(collection(firestore, 'approvalGroups'), orderBy('name')), [firestore]);
    const { data: groups, loading: groupsLoading } = useCollection<ApprovalGroup>(groupsQuery);
    
    const usersQuery = useMemo(() => query(collection(firestore, 'users'), orderBy('displayName')), [firestore]);
    const { data: allUsers, loading: usersLoading } = useCollection<UserProfileData>(usersQuery);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ApprovalGroup | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [name, setName] = useState('');
    const [memberIds, setMemberIds] = useState<string[]>([]);
    
    const { toast } = useToast();

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    useEffect(() => {
        if (isDialogOpen) {
            if (editingGroup) {
                setName(editingGroup.name);
                setMemberIds(editingGroup.memberIds || []);
            } else {
                setName('');
                setMemberIds([]);
            }
        }
    }, [editingGroup, isDialogOpen]);

    const loading = userLoading || groupsLoading || usersLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = async () => {
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Group name cannot be empty.' });
            return;
        }

        if (!user || !firestore) return;
        setIsSaving(true);
        const groupData = { name, memberIds };
        const action = editingGroup ? 'approvalGroup.update' : 'approvalGroup.create';

        try {
            let groupId: string;
            if (editingGroup) {
                groupId = editingGroup.id;
                await setDoc(doc(firestore, 'approvalGroups', groupId), groupData, { merge: true });
            } else {
                const docRef = await addDoc(collection(firestore, 'approvalGroups'), groupData);
                groupId = docRef.id;
            }

            toast({ title: editingGroup ? "Group Updated" : "Group Created" });
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid, userName: user.displayName, action: action,
                details: `${editingGroup ? 'Updated' : 'Created'} group: ${name}`,
                entity: { type: 'approvalGroup', id: groupId },
                timestamp: serverTimestamp()
            });
            
            setEditingGroup(null);
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleEdit = (group: ApprovalGroup) => {
        setEditingGroup(group);
        setIsDialogOpen(true);
    };
    
    const handleDelete = async (id: string) => {
        if (!user || !firestore) return;
        const groupToDelete = groups?.find(g => g.id === id);
        if (!groupToDelete) return;
        
        try {
            await deleteDoc(doc(firestore, 'approvalGroups', id));
            toast({ title: "Group Deleted" });
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid, userName: user.displayName, action: 'approvalGroup.delete',
                details: `Deleted group: ${groupToDelete.name}`,
                entity: { type: 'approvalGroup', id },
                timestamp: serverTimestamp()
            });
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action: 'approvalGroup.delete', errorMessage: error.message, errorStack: error.stack });
        }
    };

    const openAddDialog = () => {
        setEditingGroup(null);
        setIsDialogOpen(true);
    }

    const getUserName = (userId: string) => allUsers?.find(u => u.id === userId)?.displayName || 'Unknown User';

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users2 className="h-6 w-6 text-primary" />
                        Approval Group Management
                    </CardTitle>
                    <CardDescription>
                        Create groups of users that can collectively approve requests at a specific workflow stage.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end gap-2">
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Group
                        </Button>
                    </div>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Group Name</TableHead>
                                    <TableHead>Members</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groups && groups.map((group) => (
                                    <TableRow key={group.id}>
                                        <TableCell className="font-medium">{group.name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {group.memberIds && group.memberIds.length > 0 ? group.memberIds.map(id => (
                                                    <Badge key={id} variant="secondary">{getUserName(id)}</Badge>
                                                )) : <Badge variant="outline">No members</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(group)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(group.id)}>
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
                        <DialogTitle>{editingGroup ? 'Edit' : 'Add'} Group</DialogTitle>
                        <DialogDescription>
                            Enter the group name and select its members.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Members</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="col-span-3 text-left font-normal justify-between">
                                        <span>{memberIds.length} selected</span>
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64" align="start">
                                    <DropdownMenuLabel>Group Members</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {allUsers?.map(user => (
                                        <DropdownMenuCheckboxItem
                                            key={user.id}
                                            checked={memberIds.includes(user.id)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setMemberIds(prev => [...prev, user.id]);
                                                } else {
                                                    setMemberIds(prev => prev.filter(id => id !== user.id));
                                                }
                                            }}
                                        >
                                            <Avatar className="h-6 w-6 mr-2">
                                                <AvatarImage src={user.photoURL} alt={user.displayName} />
                                                <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            {user.displayName}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
