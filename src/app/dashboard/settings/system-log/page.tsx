'use client';
import { useDebugLog } from '@/context/debug-log-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit } from 'lucide-react';

export default function SystemLogPage() {
    const { logs, clearLogs } = useDebugLog();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-6 w-6 text-primary"/>
                    Live System Log
                </CardTitle>
                <CardDescription>
                    This is a live feed of client-side application events for diagnostic purposes. It will reset if you refresh the page.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <Button onClick={clearLogs} variant="outline">Clear Logs</Button>
                </div>
                <ScrollArea className="h-[60vh] w-full rounded-md border p-4 font-mono text-xs bg-muted/50">
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            Waiting for events... Try performing an action like saving a department.
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} className="border-b py-2">
                                <p className="font-bold text-primary">
                                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                                </p>
                                {log.data && (
                                    <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground text-[10px]">
                                        {JSON.stringify(log.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
