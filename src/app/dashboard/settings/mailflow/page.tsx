
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logErrorToFirestore } from "@/lib/error-logger";
import { useFirestore } from "@/firebase";

export default function MailflowTestPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [recipient, setRecipient] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    useEffect(() => {
        if (user) {
            setRecipient(user.email || '');
        }
    }, [user]);

    const handleSendTestEmail = async () => {
        if (!recipient) {
            toast({
                variant: 'destructive',
                title: 'Recipient missing',
                description: 'Please enter a recipient email address.',
            });
            return;
        }

        setIsSending(true);
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipient,
                    subject: 'Test Email from ProcureEase',
                    html: `
                        <h1>Hello!</h1>
                        <p>This is a test email from the ProcureEase application.</p>
                        <p>If you have received this, your email configuration is working correctly.</p>
                        <p>Timestamp: ${new Date().toUTCString()}</p>
                    `
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'An unknown error occurred.');
            }
            
            if (data.message === 'Email service not configured. Skipped sending email.') {
                 toast({
                    variant: 'destructive',
                    title: 'Email Service Not Configured',
                    description: 'Please set your email credentials in the .env file.',
                });
            } else {
                toast({
                    title: 'Test Email Sent',
                    description: `A test email has been sent to ${recipient}.`,
                });
            }

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to Send Email',
                description: error.message,
            });
            if (user && firestore) {
                await logErrorToFirestore(firestore, {
                    userId: user.uid,
                    userName: user.displayName || 'System',
                    action: 'mailflow.test',
                    errorMessage: error.message,
                    errorStack: error.stack,
                });
            }
        } finally {
            setIsSending(false);
        }
    };
    
    if (userLoading || !user || role !== 'Administrator') {
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
                    <Mail className="h-6 w-6 text-primary" />
                    Mailflow Test
                </CardTitle>
                <CardDescription>
                    Use this tool to send a test email and verify your email sending configuration.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="recipient">Recipient Email</Label>
                    <Input 
                        id="recipient" 
                        type="email" 
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="test@example.com"
                    />
                </div>
                <Button onClick={handleSendTestEmail} disabled={isSending}>
                    {isSending ? (
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Send Test Email
                </Button>
            </CardContent>
        </Card>
    );
}
