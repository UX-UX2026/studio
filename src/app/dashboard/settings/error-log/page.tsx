
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
        if (!firestore || !user) return null;
        return query(collection(firestore, 'errorLogs'), orderBy('timestamp', 'desc'));
    }, [firestore, user]);

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
                <Accordion type="single" collapsible className="w-full space-y-2">
                     {errorLogs && errorLogs.length > 0 ? (
                        errorLogs.map(log => (
                            <AccordionItem value={log.id} key={log.id} className="border rounded-lg bg-card shadow-sm">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left w-full">
                                        <Avatar className="h-9 w-9 hidden sm:flex">
                                            <AvatarFallback>{log.userName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-destructive truncate ">{log.errorMessage}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {log.userName} during <Badge variant="outline" className="text-xs font-normal">{log.action}</Badge>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground text-right pl-4">
                                        {log.timestamp ? `${formatDistanceToNow(new Date(log.timestamp.seconds * 1000))} ago` : 'N/A'}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4">
                                    <div className="border-t pt-4">
                                        <h4 className="font-semibold">Full Error Details:</h4>
                                        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground font-mono">
                                            {log.errorStack || "No stack trace available."}
                                        </pre>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))
                    ) : (
                         <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">No errors recorded yet.</p>
                        </div>
                    )}
                </Accordion>
            </CardContent>
        </Card>
    );
}
