'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader, Building2, Plus, Trash2, Edit, Upload, Download } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

type Vendor = {
    id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    category: string;
    status: 'Active' | 'Inactive';
};

const vendorCategories = [
    'IT Services',
    'IT Hardware',
    'Office Supplies',
    'Connectivity',
    'Consulting Services',
    'Software Licenses',
];

export default function VendorsPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const vendorsQuery = useMemo(() => query(collection(firestore, 'vendors'), orderBy('name')), [firestore]);
    const { data: vendors, loading: vendorsLoading } = useCollection<Vendor>(vendorsQuery);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const allowedRoles = ['Procurement Officer', 'Administrator'];
      if (userLoading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      if (role && !allowedRoles.includes(role)) {
        router.push('/dashboard');
      }
    }, [user, role, userLoading, router]);
    
    useEffect(() => {
        if (isDialogOpen) {
            if (editingVendor) {
                setName(editingVendor.name);
                setContactPerson(editingVendor.contactPerson);
                setEmail(editingVendor.email);
                setPhone(editingVendor.phone);
                setAddress(editingVendor.address || '');
                setCategory(editingVendor.category);
                setStatus(editingVendor.status);
            } else {
                setName('');
                setContactPerson('');
                setEmail('');
                setPhone('');
                setAddress('');
                setCategory('');
                setStatus('Active');
            }
        }
    }, [editingVendor, isDialogOpen]);

    const loading = userLoading || vendorsLoading;

    const allowedRoles = useMemo(() => ['Procurement Officer', 'Administrator'], []);
    if (loading || !user || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = async () => {
        if (!user || !firestore) return;
        const vendorData = {
            name,
            contactPerson,
            email,
            phone,
            address,
            category,
            status,
        };
        const action = editingVendor ? 'vendor.update' : 'vendor.create';

        try {
            if (editingVendor) {
                const vendorRef = doc(firestore, 'vendors', editingVendor.id);
                await setDoc(vendorRef, vendorData, { merge: true });
                toast({ title: 'Vendor Updated' });
                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action,
                    details: `Updated vendor: ${name}`,
                    entity: { type: 'vendor', id: editingVendor.id },
                    timestamp: serverTimestamp()
                });
            } else {
                const vendorsCollectionRef = collection(firestore, 'vendors');
                const docRef = await addDoc(vendorsCollectionRef, vendorData);
                toast({ title: 'Vendor Created' });
                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action,
                    details: `Created vendor: ${name}`,
                    entity: { type: 'vendor', id: docRef.id },
                    timestamp: serverTimestamp()
                });
            }
            setEditingVendor(null);
            setIsDialogOpen(false);
        } catch (error: any) {
            console.error("Save Vendor Error:", error);
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
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the vendor.',
            });
        }
    };
    
    const handleEdit = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setIsDialogOpen(true);
    };
    
    const handleDelete = async (id: string) => {
        if (!user || !firestore) return;
        const vendorToDelete = vendors?.find(v => v.id === id);
        const vendorRef = doc(firestore, 'vendors', id);

        try {
            await deleteDoc(vendorRef);
            toast({ title: 'Vendor Deleted' });
            if (vendorToDelete) {
                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action: 'vendor.delete',
                    details: `Deleted vendor: ${vendorToDelete.name}`,
                    entity: { type: 'vendor', id },
                    timestamp: serverTimestamp()
                });
            }
        } catch (error: any) {
            console.error("Delete Vendor Error:", error);
            try {
                await addDoc(collection(firestore, 'errorLogs'), {
                    userId: user.uid,
                    userName: user.displayName,
                    action: 'vendor.delete',
                    errorMessage: error.message,
                    errorStack: error.stack,
                    timestamp: serverTimestamp()
                });
            } catch (logError) {
                console.error("Failed to write to error log:", logError);
            }
            toast({
                variant: 'destructive',
                title: 'Delete Failed',
                description: error.message || 'Could not delete the vendor.',
            });
        }
    };

    const openAddDialog = () => {
        setEditingVendor(null);
        setIsDialogOpen(true);
    }

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (!vendors || vendors.length === 0) {
            toast({
                title: "No Data to Export",
                description: "There are no vendors to export.",
            });
            return;
        }

        const headers: (keyof Vendor)[] = ['id', 'name', 'contactPerson', 'email', 'phone', 'address', 'category', 'status'];
        const csvContent = [
            headers.join(','),
            ...vendors.map(vendor => 
                headers.map(header => `"${(vendor as any)[header] || ''}"`).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'vendors.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firestore) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            try {
                const rows = text.split('\n').filter(row => row.trim());
                if (rows.length < 2) {
                    throw new Error("CSV file must have a header and at least one data row.");
                }

                const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
                
                const newVendors = rows.slice(1).map(row => {
                    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
                    let vendor: any = {};
                    headers.forEach((header, index) => {
                        (vendor as any)[header] = values[index];
                    });

                    if (!vendor.name || !vendor.email || !vendor.category) {
                        throw new Error("CSV is missing required columns: name, email, category.");
                    }

                    return {
                        name: vendor.name,
                        contactPerson: vendor.contactPerson || '',
                        email: vendor.email,
                        phone: vendor.phone || '',
                        address: vendor.address || '',
                        category: vendor.category,
                        status: vendor.status === 'Active' || vendor.status === 'Inactive' ? vendor.status : 'Active',
                    };
                });
                
                for (const vendor of newVendors) {
                    await addDoc(collection(firestore, 'vendors'), vendor);
                }

                toast({
                    title: "Import Successful",
                    description: `${newVendors.length} vendors were added.`,
                });
            } catch (error: any) {
                console.error("CSV Parsing Error:", error);
                toast({
                    variant: "destructive",
                    title: "Import Failed",
                    description: error.message || "Could not parse the CSV file. Please check the format.",
                });
            } finally {
                if (event.target) {
                    event.target.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
            />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        Vendor Management
                    </CardTitle>
                    <CardDescription>
                        Manage your organization's vendors and suppliers. You can import or export your vendor list as a CSV file.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="h-4 w-4 mr-2" /> Import
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Vendor
                        </Button>
                    </div>
                    <div className="overflow-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vendor Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Line Item</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vendors && vendors.map((vendor) => (
                                    <TableRow key={vendor.id}>
                                        <TableCell className="font-medium">{vendor.name}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{vendor.contactPerson}</div>
                                            <div className="text-sm text-muted-foreground">{vendor.email}</div>
                                        </TableCell>
                                        <TableCell>{vendor.category}</TableCell>
                                        <TableCell>
                                            <Badge variant={vendor.status === 'Active' ? 'default' : 'secondary'} className={vendor.status === 'Active' ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                {vendor.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(vendor)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(vendor.id)}>
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
                <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle>{editingVendor ? 'Edit' : 'Add'} Vendor</DialogTitle>
                        <DialogDescription>
                            Fill in the details for the vendor. Click save when you're done.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 grid gap-4 py-4 overflow-y-auto pr-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="contactPerson" className="text-right">Contact</Label>
                            <Input id="contactPerson" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right">Phone</Label>
                            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="address" className="text-right">Address</Label>
                            <Input id="address" value={address} onChange={e => setAddress(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">Line Item</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vendorCategories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="status" className="text-right">Status</Label>
                            <Select value={status} onValueChange={(value: 'Active' | 'Inactive') => setStatus(value)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSave}>Save Vendor</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
