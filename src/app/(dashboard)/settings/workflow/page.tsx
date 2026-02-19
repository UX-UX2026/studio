'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader, Workflow, Plus, Trash2, ArrowUp, ArrowDown, Settings, Check, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/lib/roles-provider";


const allPermissions = [
    { id: 'capture', label: 'Capture & Edit Items' },
    { id: 'submit', label: 'Submit for Review' },
    { id: 'review', label: 'Review Request' },
    { id: 'comment', label: 'Add Comments' },
    { id: 'approve', label: 'Approve / Reject' },
    { id: 'lock', label: 'Lock Request' },
    { id: 'process', label: 'Process for Fulfillment' },
    { id: 'monitor', label: 'Monitor Fulfillment' },
];

type WorkflowStage = {
    id: string;
    name: string;
    role: UserRole;
    permissions: string[];
};

const initialWorkflow: WorkflowStage[] = [
    { id: 'stage-0', name: 'Request Creation', role: 'Requester', permissions: ['capture', 'submit'] },
    { id: 'stage-1', name: 'Manager Review', role: 'Manager', permissions: ['review', 'comment', 'approve'] },
    { id: 'stage-2', name: 'Executive Approval', role: 'Executive', permissions: ['review', 'comment', 'approve', 'lock'] },
    { id: 'stage-3', name: 'Procurement Processing', role: 'Procurement Officer', permissions: ['process', 'monitor'] },
];

export default function WorkflowPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [workflow, setWorkflow] = useState<WorkflowStage[]>(initialWorkflow);
    const { roles: allRoles } = useRoles();

    useEffect(() => {
        if (!loading && (!user || role !== 'Administrator')) {
            router.push('/');
        }
    }, [user, role, loading, router]);
    
    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleUpdateStage = (stageId: string, field: keyof WorkflowStage, value: any) => {
        setWorkflow(currentWorkflow =>
            currentWorkflow.map(stage => (stage.id === stageId ? { ...stage, [field]: value } : stage))
        );
    };

    const handlePermissionChange = (stageId: string, permissionId: string, isChecked: boolean | 'indeterminate') => {
        setWorkflow(currentWorkflow =>
            currentWorkflow.map(stage => {
                if (stage.id === stageId) {
                    const newPermissions = isChecked
                        ? [...stage.permissions, permissionId]
                        : stage.permissions.filter(p => p !== permissionId);
                    return { ...stage, permissions: newPermissions };
                }
                return stage;
            })
        );
    };
    
    const handleAddStage = () => {
        const newStage: WorkflowStage = {
            id: `stage-${Date.now()}`,
            name: 'New Stage',
            role: null,
            permissions: []
        };
        setWorkflow([...workflow, newStage]);
    };
    
    const handleRemoveStage = (stageId: string) => {
        setWorkflow(workflow.filter(s => s.id !== stageId));
    };

    const handleMoveStage = (index: number, direction: 'up' | 'down') => {
        const newWorkflow = [...workflow];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newWorkflow.length) return;
        
        const [movedItem] = newWorkflow.splice(index, 1);
        newWorkflow.splice(newIndex, 0, movedItem);
        
        setWorkflow(newWorkflow);
    };

    const handleSaveWorkflow = () => {
        // In a real application, you would save this to your backend.
        console.log("Saving workflow:", workflow);
        toast({
            title: "Workflow Saved",
            description: "Your approval workflow has been updated. This is a mock action.",
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-6 w-6 text-primary" />
                    Workflow Management
                </CardTitle>
                <CardDescription>
                    Design your procurement approval process by adding, ordering, and configuring stages.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4 flex justify-between items-center">
                    <Button onClick={handleAddStage}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Stage
                    </Button>
                     <Button onClick={handleSaveWorkflow}>
                        Save Workflow
                    </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]"></TableHead>
                                <TableHead>Stage Name</TableHead>
                                <TableHead className="w-[200px]">Assigned Role</TableHead>
                                <TableHead className="w-[200px]">Permissions</TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workflow.map((stage, index) => (
                                <TableRow key={stage.id}>
                                    <TableCell className="text-center text-muted-foreground font-bold cursor-grab">
                                        <GripVertical className="h-5 w-5 mx-auto" />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={stage.name}
                                            onChange={e => handleUpdateStage(stage.id, 'name', e.target.value)}
                                            className="font-semibold"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select value={stage.role || ''} onValueChange={(value) => handleUpdateStage(stage.id, 'role', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allRoles.map(r => r && <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                    {stage.permissions.length} permissions selected
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-4" align="start">
                                                 <div className="space-y-2 mb-4">
                                                    <h4 className="font-medium leading-none">Permissions</h4>
                                                    <p className="text-sm text-muted-foreground">Select actions allowed at this stage.</p>
                                                </div>
                                                <div className="grid gap-2">
                                                    {allPermissions.map(p => (
                                                        <Label key={p.id} className="flex items-center gap-2 font-normal">
                                                            <Checkbox
                                                                id={`${stage.id}-${p.id}`}
                                                                checked={stage.permissions.includes(p.id)}
                                                                onCheckedChange={checked => handlePermissionChange(stage.id, p.id, checked)}
                                                            />
                                                           {p.label}
                                                        </Label>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleMoveStage(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleMoveStage(index, 'down')} disabled={index === workflow.length - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveStage(stage.id)}>
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
    );
}
