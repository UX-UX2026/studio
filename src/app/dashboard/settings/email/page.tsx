'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Mail, Brush } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logErrorToFirestore } from "@/lib/error-logger";
import { useFirestore } from "@/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestActionRequiredTemplate, queryRaisedTemplate, requestRejectedTemplate, workflowTestTemplate } from "@/lib/email-templates";
import { ScrollArea } from "@/components/ui/scroll-area";

function MailflowTest() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [recipient, setRecipient] = useState('');
    const [isSending, setIsSending] = useState(false);

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
                    html: `<h1>Hello!</h1><p>This is a test email from the ProcureEase application.</p><p>If you have received this, your email configuration is working correctly.</p><p>Timestamp: ${new Date().toUTCString()}</p>`
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
    
    return (
        <div className="space-y-6">
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
                {isSending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Test Email
            </Button>
        </div>
    );
}

const mockRequest = { id: 'PREQ-12345678', department: 'IT Department', total: 12500.50, submittedBy: 'John Doe' };
const mockComment = { actor: 'Jane Manager', text: 'This is a test query, please provide more details.' };
const mockLink = '#';

const templates = [
    { name: "Action Required", description: "Sent when a request moves to a new stage requiring approval.", template: requestActionRequiredTemplate(mockRequest, 'Executive Approval', mockLink) },
    { name: "Query Raised", description: "Sent to the submitter when an approver raises a query.", template: queryRaisedTemplate(mockRequest, mockComment, mockLink) },
    { name: "Request Rejected", description: "Sent to the submitter when their request is rejected.", template: requestRejectedTemplate(mockRequest, { ...mockComment, text: "REJECTED: Budget exceeded." }, mockLink) },
    { name: "Workflow Test", description: "Used when testing workflow notifications from the settings page.", template: workflowTestTemplate('Manager Review', ['manager@example.com', 'admin@example.com']) }
];

export default function EmailSettingsPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

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
                    Email & Notification Settings
                </CardTitle>
                <CardDescription>
                    Preview email templates and test your email sending configuration.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="templates">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="templates">Email Templates</TabsTrigger>
                        <TabsTrigger value="test">Mailflow Test</TabsTrigger>
                    </TabsList>
                    <TabsContent value="templates" className="pt-6">
                        <div className="space-y-6">
                            {templates.map(t => (
                                <Card key={t.name}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><Brush className="h-5 w-5 text-primary/80" />{t.name}</CardTitle>
                                        <CardDescription>{t.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ScrollArea className="h-80 w-full rounded-md border">
                                            <iframe
                                                srcDoc={t.template}
                                                className="w-full h-full"
                                                sandbox="" 
                                            />
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="test" className="pt-6">
                        <MailflowTest />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}