
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Briefcase, Plus, Trash2, Edit } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";

type Company = {
    id: string;
    name: string;
    logoUrl?: string;
};

export default function CompaniesPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const companiesQuery = useMemo(() => query(collection(firestore, 'companies'), orderBy('name')), [firestore]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [name, setName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    
    const { toast } = useToast();

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    useEffect(() => {
        if (isDialogOpen) {
            if (editingCompany) {
                setName(editingCompany.name);
                setLogoUrl(editingCompany.logoUrl || '');
            } else {
                setName('');
                setLogoUrl('');
            }
        }
    }, [editingCompany, isDialogOpen]);

    const loading = userLoading || companiesLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = async () => {
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Company name cannot be empty.' });
            return;
        }

        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'User or database service not available.' });
            return;
        }

        setIsSaving(true);
        const companyData = { name, logoUrl };
        const action = editingCompany ? 'company.update' : 'company.create';

        try {
            let companyId: string;
            if (editingCompany) {
                companyId = editingCompany.id;
                const companyRef = doc(firestore, 'companies', companyId);
                await setDoc(companyRef, companyData, { merge: true });
            } else {
                const newDocRef = await addDoc(collection(firestore, 'companies'), companyData);
                companyId = newDocRef.id;
            }

            toast({ title: editingCompany ? "Company Updated" : "Company Created" });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `${editingCompany ? 'Updated' : 'Created'} company: ${name}`,
                entity: { type: 'company', id: companyId },
                timestamp: serverTimestamp()
            });
            
            setEditingCompany(null);
            setIsDialogOpen(false);

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the company.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleEdit = (company: Company) => {
        setEditingCompany(company);
        setIsDialogOpen(true);
    };
    
    const handleDelete = async (id: string) => {
        if (!user || !firestore) return;
        
        const companyToDelete = companies?.find(c => c.id === id);
        if (!companyToDelete) return;

        const companyRef = doc(firestore, 'companies', id);
        const action = 'company.delete';

        try {
            await deleteDoc(companyRef);
            toast({ title: "Company Deleted" });
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Deleted company: ${companyToDelete.name}`,
                entity: { type: 'company', id },
                timestamp: serverTimestamp()
            });
        } catch(error: any) {
            toast({
                variant: 'destructive',
                title: 'Delete Failed',
                description: error.message || 'Could not delete the company.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        }
    };

    const openAddDialog = () => {
        setEditingCompany(null);
        setIsDialogOpen(true);
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-6 w-6 text-primary" />
                        Company Management
                    </CardTitle>
                    <CardDescription>
                        Manage the companies or legal entities that departments can be associated with.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end gap-2">
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Company
                        </Button>
                    </div>
                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company Name</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {companies && companies.map((company) => (
                                    <TableRow key={company.id}>
                                        <TableCell className="font-medium">{company.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)}>
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
                        <DialogTitle>{editingCompany ? 'Edit' : 'Add'} Company</DialogTitle>
                        <DialogDescription>
                            Enter the name for the company and an optional logo URL.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="logoUrl" className="text-right">Logo URL</Label>
                            <Input id="logoUrl" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="col-span-3" placeholder="https://example.com/logo.png" />
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
