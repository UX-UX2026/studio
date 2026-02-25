'use client';

import { useState } from 'react';
import { useFirestore, useUser } from "@/firebase";
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader, AlertTriangle, CheckCircle, DatabaseZap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function DatabaseDiagnosticPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [status, setStatus] = useState<TestStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleTestConnection = () => {
        if (!firestore || !user) {
            toast({
                variant: 'destructive',
                title: 'Prerequisites Missing',
                description: 'Firestore service or user is not available.',
            });
            return;
        }

        setStatus('testing');
        setError(null);
        
        // Set a manual timeout. If the database operation doesn't respond in 11 seconds,
        // we'll manually force an error state. This prevents the UI from hanging indefinitely.
        const timeoutId = setTimeout(() => {
            setStatus('error');
            setError("The operation timed out. This confirms a network connectivity issue between the application environment and Google's servers.");
            toast({
                variant: 'destructive',
                title: 'Connection Timed Out',
                description: "The database did not respond within the expected time.",
            });
        }, 11000); // Firestore's internal timeout is 10s.

        const testDocRef = doc(firestore, '_diagnostics', `test_${Date.now()}`);
        const testData = {
            message: 'This is a diagnostic write test from the app.',
            userId: user.uid,
            timestamp: serverTimestamp(),
        };

        setDoc(testDocRef, testData)
            .then(() => {
                clearTimeout(timeoutId); // Success! Prevent the manual timeout from firing.
                setStatus('success');
                toast({
                    title: 'Connection Successful',
                    description: 'A test document was successfully written to Firestore.',
                });
            })
            .catch((e: any) => {
                clearTimeout(timeoutId); // The promise failed. Prevent the manual timeout from firing.
                console.error('Database Diagnostic Error:', e);
                setStatus('error');
                setError(e.message || 'An unknown error occurred.');
                toast({
                    variant: 'destructive',
                    title: 'Connection Failed',
                    description: e.message || 'Could not write to the database.',
                });
            });
    };

    const renderStatus = () => {
        switch (status) {
            case 'testing':
                return (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader className="h-4 w-4 animate-spin" />
                        Attempting to write a test document... (waiting up to 11 seconds)
                    </div>
                );
            case 'success':
                return (
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Success! The database connection is working correctly.
                    </div>
                );
            case 'error':
                return (
                    <div className="flex flex-col gap-2 text-destructive">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Connection Failed. The application could not write to the database.
                        </div>
                        <p className="font-mono bg-muted p-2 rounded-md text-xs">{error}</p>
                    </div>
                );
            case 'idle':
            default:
                return <p className="text-muted-foreground">Click the button to test the database connection.</p>;
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <DatabaseZap className="h-6 w-6 text-primary" />
                    Database Connection Test
                </CardTitle>
                <CardDescription>
                    This tool attempts a direct write to your Firestore database to verify the connection.
                    It includes a manual timeout to ensure the application provides feedback even if the network is unresponsive.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Button onClick={handleTestConnection} disabled={status === 'testing'}>
                    {status === 'testing' ? (
                        <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Running Test...
                        </>
                    ) : (
                        'Run Connection Test'
                    )}
                </Button>
                <div className="p-4 border rounded-lg min-h-[80px] flex items-center justify-center">
                    {renderStatus()}
                </div>
            </CardContent>
        </Card>
    );
}
