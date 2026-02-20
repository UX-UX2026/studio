'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type AuditEvent = {
    id: string;
    userId: string;
    userName: string;
    action: string;
    details: string;
    timestamp: { seconds: number; nanoseconds: number; };
};

export default function AuditLogPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const auditLogsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'auditLogs'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: auditLogs, loading: logsLoading } = useCollection<AuditEvent>(auditLogsQuery);

    useEffect(() => {
        if (!userLoading && (!user || role !== 'Administrator')) {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const loading = userLoading || logsLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const getActionBadge = (action: string) => {
        const actionType = action.split('.')[0];
        switch(actionType) {
            case 'user': return <Badge variant="outline" className="text-blue-500 border-blue-500">{action}</Badge>;
            case 'request': return <Badge variant="outline" className="text-orange-500 border-orange-500">{action}</Badge>;
            case 'department': return <Badge variant="outline" className="text-purple-500 border-purple-500">{action}</Badge>;
            case 'role': return <Badge variant="outline" className="text-indigo-500 border-indigo-500">{action}</Badge>;
            case 'vendor': return <Badge variant="outline" className="text-green-500 border-green-500">{action}</Badge>;
            default: return <Badge variant="secondary">{action}</Badge>;
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-6 w-6 text-primary" />
                    Audit Log
                </CardTitle>
                <CardDescription>
                    A chronological log of all significant actions performed within the application.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">User</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="w-[200px] text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {auditLogs && auditLogs.length > 0 ? (
                                auditLogs.map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>{log.userName?.charAt(0) || 'U'}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{log.userName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getActionBadge(log.action)}</TableCell>
                                        <TableCell className="text-muted-foreground">{log.details}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {log.timestamp ? format(new Date(log.timestamp.seconds * 1000), "dd MMM yyyy, HH:mm") : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No audit events recorded yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
