
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Eraser, AlertTriangle, Download, HardDriveDownload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { collection, writeBatch, getDocs, query, serverTimestamp, addDoc } from "firebase/firestore";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";


export default function DataManagementPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const loading = userLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleExportAllSubmissions = async () => {
        if (!firestore || !user) return;
        setIsExporting(true);
        const action = 'system.export_all_submissions';
    
        try {
            const q = query(collection(firestore, 'procurementRequests'));
            const snapshot = await getDocs(q);
    
            if (snapshot.empty) {
                toast({ title: "No Data", description: "There are no submissions to export." });
                return;
            }
    
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            link.download = `procurement_submissions_backup_${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
    
            toast({
                title: "Export Successful",
                description: `Successfully exported ${snapshot.size} submissions.`,
            });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Exported all ${snapshot.size} procurement submissions.`,
                entity: { type: 'system', id: 'all_submissions' },
                timestamp: serverTimestamp()
            });
    
        } catch (error: any) {
            console.error("Export Error:", error);
            toast({
                variant: 'destructive',
                title: 'Export Failed',
                description: error.message || 'Could not export submissions.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAllSubmissions = async () => {
        if (!firestore || !user) return;
        setIsSubmitting(true);
        const action = 'system.clear_all_submissions';

        try {
            const batch = writeBatch(firestore);
            const q = query(collection(firestore, 'procurementRequests'));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                toast({ title: "No Data", description: "There are no procurement submissions to delete." });
                return;
            }

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            toast({
                title: "Submissions Cleared",
                description: `Successfully deleted ${snapshot.size} procurement submissions.`,
            });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Permanently deleted all ${snapshot.size} procurement submissions.`,
                entity: { type: 'system', id: 'all_submissions' },
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
             console.error("Clear All Submissions Error:", error);
            toast({
                variant: 'destructive',
                title: 'Operation Failed',
                description: error.message || 'Could not delete submissions.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSubmitting(false);
            setIsDialogOpen(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDriveDownload className="h-6 w-6 text-primary" />
                        Backup & Export
                    </CardTitle>
                    <CardDescription>
                        Export all procurement submissions to a JSON file. This is highly recommended before performing any data deletion.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleExportAllSubmissions} disabled={isExporting}>
                        {isExporting ? (
                            <Loader className="mr-2 h-4 w-4 animate-spin"/>
                        ) : (
                            <Download className="mr-2 h-4 w-4"/>
                        )}
                        Export All Submissions (JSON)
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eraser className="h-6 w-6 text-primary" />
                        Data Management
                    </CardTitle>
                    <CardDescription>
                        Perform system-wide data operations. These actions are permanent and cannot be undone.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Card className="border-destructive bg-destructive/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-destructive">
                                <AlertTriangle />
                                Danger Zone
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-destructive/80">
                                This action will permanently delete all procurement requests from the database. This is useful for clearing test data before a go-live, but it is irreversible. Please use the export tool first.
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="destructive" onClick={() => setIsDialogOpen(true)} disabled={isSubmitting}>
                                {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                                Delete All Submissions
                            </Button>
                        </CardFooter>
                    </Card>
                </CardContent>
            </Card>

            <AlertDialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                    setIsDeleteConfirmed(false);
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action is permanent and cannot be undone. It is highly recommended to use the **Export** tool before deleting.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex items-center space-x-2 my-4 p-4 bg-muted rounded-md">
                        <Checkbox id="confirm-delete" checked={isDeleteConfirmed} onCheckedChange={(checked) => setIsDeleteConfirmed(!!checked)} />
                        <Label htmlFor="confirm-delete" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            I understand this will delete all submissions and I have made a backup.
                        </Label>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAllSubmissions} disabled={!isDeleteConfirmed} className="bg-destructive hover:bg-destructive/90">
                            Yes, delete everything
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
