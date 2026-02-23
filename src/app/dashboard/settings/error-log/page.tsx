
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type ErrorLogEvent = {
    id: string;
    userId: string;
    userName: string;
    action: string;
    errorMessage: string;
    errorStack?: string;
    timestamp: { seconds: number; nanoseconds: number; };
};

export default function ErrorLogPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const errorLogsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'errorLogs'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: errorLogs, loading: logsLoading } = useCollection<ErrorLogEvent>(errorLogsQuery);

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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                    Application Error Log
                </CardTitle>
                <CardDescription>
                    A chronological log of all client-side errors captured within the application. Use this for debugging and monitoring.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">User</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Error Message</TableHead>
                                <TableHead className="w-[180px] text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {errorLogs && errorLogs.length > 0 ? (
                                errorLogs.map(log => (
                                    <Accordion type="single" collapsible className="w-full" asChild>
                                        <AccordionItem value={log.id} asChild>
                                             <tr key={log.id} className="border-b">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback>{log.userName?.charAt(0) || 'U'}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{log.userName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                                                <TableCell className="max-w-md">
                                                    <AccordionTrigger className="py-0 hover:no-underline text-left">
                                                        <p className="truncate text-destructive font-medium">{log.errorMessage}</p>
                                                    </AccordionTrigger>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {log.timestamp ? `${formatDistanceToNow(new Date(log.timestamp.seconds * 1000))} ago` : 'N/A'}
                                                </TableCell>
                                                <AccordionContent asChild>
                                                   <tr className="bg-muted/50">
                                                        <TableCell colSpan={4} className="p-4">
                                                            <h4 className="font-semibold">Error Stack Trace:</h4>
                                                            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-muted-foreground font-mono">
                                                                {log.errorStack || "No stack trace available."}
                                                            </pre>
                                                        </TableCell>
                                                    </tr>
                                                </AccordionContent>
                                            </tr>
                                        </AccordionItem>
                                    </Accordion>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No errors recorded yet.
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
