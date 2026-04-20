
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, where } from "firebase/firestore";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { AuditEvent } from "@/types";

export default function NotificationLogPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const notificationLogsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'auditLogs'), 
            where('action', 'in', ['notification.sent', 'notification.failed', 'notification.test_sent', 'notification.test_failed', 'notification.reminder_sent', 'notification.reminder_failed']),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, user]);

    const { data: notificationLogs, loading: logsLoading } = useCollection<AuditEvent>(notificationLogsQuery);

    useEffect(() => {
        if (userLoading) return;
        if (!user) {
          router.push('/dashboard');
          return;
        }
        if (role && role !== 'Administrator') {
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
        const actionType = action.split('.')[1];
        switch(actionType) {
            case 'sent': return <Badge variant="outline" className="text-green-500 border-green-500">Sent</Badge>;
            case 'failed': return <Badge variant="destructive">Failed</Badge>;
            case 'test_sent': return <Badge variant="outline" className="text-blue-500 border-blue-500">Test Sent</Badge>;
            case 'test_failed': return <Badge variant="destructive">Test Failed</Badge>;
            case 'reminder_sent': return <Badge variant="outline" className="text-cyan-500 border-cyan-500">Reminder Sent</Badge>;
             case 'reminder_failed': return <Badge variant="destructive">Reminder Failed</Badge>;
            default: return <Badge variant="secondary">{action}</Badge>;
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-6 w-6 text-primary" />
                    Email Notification Log
                </CardTitle>
                <CardDescription>
                    A log of all email notifications sent by the system, including successes and failures.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">User</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Target Entity</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="w-[150px] text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {notificationLogs && notificationLogs.length > 0 ? (
                                notificationLogs.map(log => (
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
                                        <TableCell>
                                            {log.entity ? (
                                                <Badge variant="outline">{log.entity.type} / {log.entity.id.substring(0,6)}...</Badge>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{log.details}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {log.timestamp ? format(new Date(log.timestamp.seconds * 1000), "PPpp") : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No email notification events recorded yet.
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
