

'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Recycle, Trash2, Undo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, doc, updateDoc, deleteDoc, serverTimestamp, addDoc, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { type ApprovalRequest } from "@/lib/approvals-mock-data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logErrorToFirestore } from "@/lib/error-logger";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
    }).format(amount);
};

export default function RecycleBinPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);

    const archivedRequestsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'procurementRequests'), where('status', '==', 'Archived'), orderBy('updatedAt', 'desc'));
    }, [firestore, user]);

    const { data: archivedRequests, loading: requestsLoading } = useCollection<ApprovalRequest>(archivedRequestsQuery);

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const loading = userLoading || requestsLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleRestore = async (id: string) => {
        if (!firestore || !user) return;
        const action = 'request.draft_restore';
        try {
            const docRef = doc(firestore, 'procurementRequests', id);
            await updateDoc(docRef, { status: 'Draft', updatedAt: serverTimestamp() as any });
            toast({ title: 'Draft Restored', description: 'The submission has been moved back to drafts.' });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action,
                details: `Restored archived request.`,
                entity: { type: 'procurementRequest', id },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Restore Failed', description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action, errorMessage: error.message, errorStack: error.stack });
        }
    };
    
    const handleDeletePermanently = async () => {
        if (!deletingRequestId || !firestore || !user) return;
        const action = 'request.draft_delete_permanent';
        try {
            const docRef = doc(firestore, 'procurementRequests', deletingRequestId);
            await deleteDoc(docRef);
            toast({ title: 'Draft Deleted', description: 'The draft has been permanently deleted.' });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action,
                details: `Permanently deleted archived request.`,
                entity: { type: 'procurementRequest', id: deletingRequestId },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setDeletingRequestId(null);
            setIsDialogOpen(false);
        }
    }

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Recycle className="h-6 w-6 text-primary" />
                    Recycle Bin
                </CardTitle>
                <CardDescription>
                    Review, restore, or permanently delete archived procurement submissions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Department</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Archived On</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {archivedRequests && archivedRequests.length > 0 ? (
                                archivedRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{req.department}</TableCell>
                                        <TableCell>{req.period}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(req.total)}</TableCell>
                                        <TableCell>{req.updatedAt ? format(new Date(req.updatedAt.seconds * 1000), "yyyy-MM-dd") : 'N/A'}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => handleRestore(req.id)}>
                                                <Undo className="h-4 w-4 mr-2" />
                                                Restore
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => { setDeletingRequestId(req.id); setIsDialogOpen(true); }}>
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        The recycle bin is empty.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete this draft. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeletingRequestId(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeletePermanently} className="bg-destructive hover:bg-destructive/90">Delete Forever</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
