

'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Mail, Brush, BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logErrorToFirestore } from "@/lib/error-logger";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestActionRequiredTemplate, queryRaisedTemplate, requestRejectedTemplate, workflowTestTemplate, reminderTemplate } from "@/lib/email-templates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { doc, setDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import type { ApprovalRequest, AppMetadata } from "@/types";
import { formatDistanceToNow } from "date-fns";

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
        const action = 'notification.test_sent';
        const failAction = 'notification.test_failed';

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
                throw new Error('Email service not configured');
            } else {
                toast({
                    title: 'Test Email Sent',
                    description: `A test email has been sent to ${recipient}.`,
                });
                if (user && firestore) {
                     await addDoc(collection(firestore, 'auditLogs'), {
                        userId: user.uid, userName: user.displayName, action,
                        details: `Sent test email to ${recipient}.`, timestamp: serverTimestamp()
                    });
                }
            }

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to Send Email',
                description: error.message,
            });
            if (user && firestore) {
                await addDoc(collection(firestore, 'auditLogs'), {
                    userId: user.uid, userName: user.displayName, action: failAction,
                    details: `Failed to send test email to ${recipient}: ${error.message}`, timestamp: serverTimestamp()
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
    { name: "Reminder", description: "Sent as a reminder for requests awaiting approval.", template: reminderTemplate(mockRequest, 'Executive Approval', mockLink) },
    { name: "Query Raised", description: "Sent to the submitter when an approver raises a query.", template: queryRaisedTemplate(mockRequest, mockComment, mockLink) },
    { name: "Request Rejected", description: "Sent to the submitter when their request is rejected.", template: requestRejectedTemplate(mockRequest, { ...mockComment, text: "REJECTED: Budget exceeded." }, mockLink) },
    { name: "Workflow Test", description: "Used when testing workflow notifications from the settings page.", template: workflowTestTemplate('Manager Review', ['manager@example.com', 'admin@example.com']) }
];

function RemindersSettings() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);
    const requestsQuery = useMemo(() => query(collection(firestore, 'procurementRequests'), where('status', 'in', ['Pending Manager Approval', 'Pending Executive'])), [firestore]);
    const { data: pendingRequests } = useCollection<ApprovalRequest>(requestsQuery);

    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'off'>('daily');

    useEffect(() => {
        if (appMetadata?.reminderSettings) {
            setFrequency(appMetadata.reminderSettings.frequency);
        }
    }, [appMetadata]);

    const handleSaveSettings = async () => {
        if (!user || !firestore) return;
        setIsSaving(true);
        const action = 'settings.reminders_update';
        try {
            await setDoc(appMetadataRef, { reminderSettings: { frequency } }, { merge: true });
            toast({ title: 'Reminder settings saved' });
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid, userName: user.displayName, action,
                details: `Updated reminder frequency to ${frequency}`,
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save failed', description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: user.displayName, action, errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendReminders = async () => {
        if (!user || !firestore || !pendingRequests) {
            toast({variant: 'destructive', title: 'Cannot send', description: 'Missing required data.'});
            return;
        }
        setIsSending(true);
        const successAction = 'notification.reminder_sent';
        const failAction = 'notification.reminder_failed';
        let sentCount = 0;
        
        try {
            for (const req of pendingRequests) {
                const pendingStage = req.timeline.find(t => t.status === 'pending');
                if (!pendingStage) continue;
                
                const q = query(collection(firestore, 'users'), where('role', '==', pendingStage.actor));
                const snapshot = await getDocs(q);
                const recipients = snapshot.docs.map(d => d.data().email).filter(Boolean);

                if (recipients.length > 0) {
                     try {
                        const response = await fetch('/api/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: recipients.join(','),
                                subject: `REMINDER: Request ${req.id.substring(0,8)}... is Awaiting Approval`,
                                html: reminderTemplate(req, pendingStage.stage, `${window.location.origin}/dashboard/approvals?id=${req.id}`)
                            })
                        });
                        if (!response.ok) throw new Error('Server responded with an error');
                        sentCount++;
                        await addDoc(collection(firestore, 'auditLogs'), {
                            userId: user.uid, userName: 'System', action: successAction,
                            details: `Reminder sent to ${recipients.join(', ')} for request ${req.id}`,
                            entity: { type: 'procurementRequest', id: req.id },
                            timestamp: serverTimestamp()
                        });
                    } catch (emailError: any) {
                         await addDoc(collection(firestore, 'auditLogs'), {
                            userId: user.uid, userName: 'System', action: failAction,
                            details: `Failed to send reminder to ${recipients.join(', ')}: ${emailError.message}`,
                            entity: { type: 'procurementRequest', id: req.id },
                            timestamp: serverTimestamp()
                        });
                    }
                }
            }

            await setDoc(appMetadataRef, { reminderSettings: { frequency, lastSent: new Date() } }, { merge: true });
            
            toast({ title: 'Reminders Sent', description: `Sent ${sentCount} reminder emails.` });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Send failed', description: error.message });
             await logErrorToFirestore(firestore, { userId: user.uid, userName: 'System', action: 'reminders.manual_send_process', errorMessage: error.message, errorStack: error.stack });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                 <h3 className="text-lg font-semibold">Reminder Frequency</h3>
                 <p className="text-sm text-muted-foreground">
                    Set how often reminders should be sent for pending approvals. This is a placeholder; actual automated sending requires a backend cron job.
                 </p>
                <div className="flex items-end gap-4">
                    <div className="grid w-full max-w-xs items-center gap-1.5">
                        <Label htmlFor="frequency">Frequency</Label>
                         <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                            <SelectTrigger id="frequency">
                                <SelectValue placeholder="Select frequency..."/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="off">Off</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <Button onClick={handleSaveSettings} disabled={isSaving}>
                        {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Save Settings
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                 <h3 className="text-lg font-semibold">Manual Trigger</h3>
                 <p className="text-sm text-muted-foreground">
                    Manually send reminder emails for all requests currently awaiting approval. Last sent: {appMetadata?.reminderSettings?.lastSent ? formatDistanceToNow(new Date(appMetadata.reminderSettings.lastSent.seconds * 1000), { addSuffix: true }) : 'never'}.
                 </p>
                <Button onClick={handleSendReminders} disabled={isSending}>
                    {isSending ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <BellRing className="mr-2 h-4 w-4"/>}
                    Send Reminders Now
                </Button>
            </div>
        </div>
    );
}

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
                    Preview email templates, test your email sending configuration, and manage approval reminders.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="templates">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="templates">Email Templates</TabsTrigger>
                        <TabsTrigger value="reminders">Reminders</TabsTrigger>
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
                    <TabsContent value="reminders" className="pt-6">
                        <RemindersSettings />
                    </TabsContent>
                    <TabsContent value="test" className="pt-6">
                        <MailflowTest />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
