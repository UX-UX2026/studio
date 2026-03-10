
'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Workflow as WorkflowIcon, Plus, Trash2, ArrowUp, ArrowDown, GripVertical, Save, Mail } from "lucide-react";
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
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";

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
    useAlternateEmail?: boolean;
    alternateEmail?: string;
    sendToBoth?: boolean;
};

type Department = {
  id: string;
  name: string;
  workflow?: WorkflowStage[];
};

const initialWorkflow: WorkflowStage[] = [
    { id: 'stage-0', name: 'Request Creation', role: 'Requester', permissions: ['capture', 'submit', 'comment'], useAlternateEmail: false, alternateEmail: '', sendToBoth: false },
    { id: 'stage-1', name: 'Manager Review', role: 'Manager', permissions: ['review', 'comment', 'approve'], useAlternateEmail: false, alternateEmail: '', sendToBoth: false },
    { id: 'stage-2', name: 'Executive Approval', role: 'Executive', permissions: ['review', 'comment', 'approve', 'lock'], useAlternateEmail: false, alternateEmail: '', sendToBoth: false },
    { id: 'stage-3', name: 'Procurement Processing', role: 'Procurement Officer', permissions: ['process', 'monitor', 'comment'], useAlternateEmail: false, alternateEmail: '', sendToBoth: false },
];

export default function WorkflowPage() {
    const { user, role: adminRole, loading: userLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const { roles: allRoles } = useRoles();
    const firestore = useFirestore();

    const departmentsQuery = useMemo(() => collection(firestore, 'departments'), [firestore]);
    const { data: departments, loading: deptsLoading } = useCollection<Department>(departmentsQuery);

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [workflow, setWorkflow] = useState<WorkflowStage[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (userLoading) return;
        if (!user) {
          router.push('/dashboard');
          return;
        }
        if (adminRole && adminRole !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, adminRole, userLoading, router]);

    useEffect(() => {
        // Set a default department if none is selected
        if (departments && departments.length > 0 && !selectedDepartmentId) {
            setSelectedDepartmentId(departments[0].id);
        }
    }, [departments, selectedDepartmentId]);
    
    useEffect(() => {
        // Update workflow state when department changes
        if (selectedDepartmentId && departments) {
            const department = departments.find(d => d.id === selectedDepartmentId);
            setWorkflow(department?.workflow || initialWorkflow);
        }
    }, [selectedDepartmentId, departments]);
    
    const loading = userLoading || deptsLoading;
    
    if (loading || !user || adminRole !== 'Administrator') {
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
            permissions: [],
            useAlternateEmail: false,
            alternateEmail: '',
            sendToBoth: false
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

    const handleSaveWorkflow = async () => {
        if (!selectedDepartmentId || !firestore || !user) {
             toast({
                variant: "destructive",
                title: "No Department Selected",
                description: "Please select a department to save the workflow.",
            });
            return;
        }
        
        setIsSaving(true);
        const departmentRef = doc(firestore, 'departments', selectedDepartmentId);
        const payload = { workflow };
        const action = 'workflow.update';

        try {
            await setDoc(departmentRef, payload, { merge: true });
            toast({
                title: "Workflow Saved",
                description: `The approval workflow for ${departments?.find(d=>d.id === selectedDepartmentId)?.name} has been updated.`,
            });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action,
                details: `Updated workflow for department ${departments?.find(d=>d.id === selectedDepartmentId)?.name}.`,
                entity: { type: 'department', id: selectedDepartmentId },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Save Workflow Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the workflow.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <WorkflowIcon className="h-6 w-6 text-primary" />
                    Workflow Management
                </CardTitle>
                <CardDescription>
                    Design your procurement approval process by adding, ordering, and configuring stages for each department.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="department-select">Department:</Label>
                        <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                            <SelectTrigger className="w-[250px]" id="department-select">
                                <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments?.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="flex items-center gap-2">
                         <Button onClick={handleAddStage} disabled={!selectedDepartmentId}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Stage
                        </Button>
                        <Button onClick={handleSaveWorkflow} disabled={!selectedDepartmentId || isSaving}>
                            {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                            Save Workflow
                        </Button>
                     </div>
                </div>

                {selectedDepartmentId ? (
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]"></TableHead>
                                    <TableHead>Stage Name</TableHead>
                                    <TableHead className="w-[200px]">Assigned Role</TableHead>
                                    <TableHead>Permissions</TableHead>
                                    <TableHead>Notifications</TableHead>
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
                                                        <h4 className="font-medium leading-none">Permissions for "{stage.name}"</h4>
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
                                        <TableCell>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="gap-2">
                                                        <Mail className="h-4 w-4" />
                                                        <span>Configure</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80" align="start">
                                                    <div className="grid gap-4">
                                                        <div className="space-y-2">
                                                            <h4 className="font-medium leading-none">Notification Settings</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                Set an alternative email for notifications at this stage.
                                                            </p>
                                                        </div>
                                                        <div className="grid gap-2">
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`alt-email-check-${stage.id}`}
                                                                    checked={stage.useAlternateEmail}
                                                                    onCheckedChange={(checked) => handleUpdateStage(stage.id, 'useAlternateEmail', !!checked)}
                                                                />
                                                                <Label htmlFor={`alt-email-check-${stage.id}`}>
                                                                    Use alternative email
                                                                </Label>
                                                            </div>
                                                            {stage.useAlternateEmail && (
                                                                <div className="grid gap-4 pl-6 pt-2">
                                                                    <div className="grid gap-2">
                                                                        <Label htmlFor={`alt-email-input-${stage.id}`}>
                                                                            Alternative Email
                                                                        </Label>
                                                                        <Input
                                                                            id={`alt-email-input-${stage.id}`}
                                                                            type="email"
                                                                            placeholder="alt.email@example.com"
                                                                            value={stage.alternateEmail || ''}
                                                                            onChange={(e) => handleUpdateStage(stage.id, 'alternateEmail', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id={`send-both-check-${stage.id}`}
                                                                            checked={stage.sendToBoth}
                                                                            onCheckedChange={(checked) => handleUpdateStage(stage.id, 'sendToBoth', !!checked)}
                                                                        />
                                                                        <Label htmlFor={`send-both-check-${stage.id}`}>
                                                                            Send to both primary and alternative email
                                                                        </Label>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
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
                ) : (
                    <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Please select a department to manage its workflow.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

    
