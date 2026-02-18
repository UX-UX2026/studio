'use client';

import { useUser, UserRole } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader, Building2, Plus, Trash2, Edit } from "lucide-react";
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
import { mockVendors as initialMockVendors, type Vendor } from "@/lib/vendors-mock-data";

const vendorCategories = [
    'IT Services',
    'IT Hardware',
    'Office Supplies',
    'Connectivity',
    'Consulting Services',
    'Software Licenses',
];

export default function VendorsPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    const [vendors, setVendors] = useState<Vendor[]>(initialMockVendors);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');


    useEffect(() => {
      if (!loading && (!user || (role !== 'Procurement Officer' && role !== 'Administrator'))) {
        router.push('/');
      }
    }, [user, role, loading, router]);
    
    useEffect(() => {
        if (isDialogOpen) {
            if (editingVendor) {
                setName(editingVendor.name);
                setContactPerson(editingVendor.contactPerson);
                setEmail(editingVendor.email);
                setPhone(editingVendor.phone);
                setCategory(editingVendor.category);
                setStatus(editingVendor.status);
            } else {
                setName('');
                setContactPerson('');
                setEmail('');
                setPhone('');
                setCategory('');
                setStatus('Active');
            }
        }
    }, [editingVendor, isDialogOpen]);

    if (loading || !user || (role !== 'Procurement Officer' && role !== 'Administrator')) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSave = () => {
        const vendorData: Vendor = {
            id: editingVendor?.id || `ven-${Date.now()}`,
            name,
            contactPerson,
            email,
            phone,
            category,
            status,
        };

        if (editingVendor) {
            setVendors(vendors.map(v => v.id === vendorData.id ? vendorData : v));
        } else {
            setVendors([...vendors, vendorData]);
        }
        setEditingVendor(null);
        setIsDialogOpen(false);
    };
    
    const handleEdit = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setIsDialogOpen(true);
    };
    
    const handleDelete = (id: string) => {
        setVendors(vendors.filter(v => v.id !== id));
    };

    const openAddDialog = () => {
        setEditingVendor(null);
        setIsDialogOpen(true);
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        Vendor Management
                    </CardTitle>
                    <CardDescription>
                        Manage your organization's vendors and suppliers.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-end">
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Vendor
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vendor Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vendors.map((vendor) => (
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
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingVendor ? 'Edit' : 'Add'} Vendor</DialogTitle>
                        <DialogDescription>
                            Fill in the details for the vendor. Click save when you're done.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
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
                            <Label htmlFor="category" className="text-right">Category</Label>
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
                    <DialogFooter>
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
