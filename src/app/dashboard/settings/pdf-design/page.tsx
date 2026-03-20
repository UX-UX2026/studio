
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Palette, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import Link from "next/link";

type PdfSettings = {
    primaryColor?: string;
};

type AppMetadata = {
    id: string;
    pdfSettings?: PdfSettings;
};

export default function PdfDesignPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const appMetadataRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'app', 'metadata');
    }, [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const [settings, setSettings] = useState<PdfSettings>({
        primaryColor: '#c97353' // default color from the app
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (appMetadata?.pdfSettings) {
            setSettings(appMetadata.pdfSettings);
        }
    }, [appMetadata]);

    useEffect(() => {
        if (userLoading) return;
        if (!user || role !== 'Administrator') {
            router.push('/dashboard');
        }
    }, [user, role, userLoading, router]);

    const loading = userLoading || metadataLoading;

    if (loading || !user || role !== 'Administrator') {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const handleSettingChange = (field: keyof PdfSettings, value: string) => {
        setSettings(prev => ({...prev, [field]: value}));
    };

    const handleSaveChanges = async () => {
        if (!user || !firestore || !appMetadataRef) {
            toast({ variant: "destructive", title: "Save failed", description: "Required services are not available." });
            return;
        }

        setIsSaving(true);
        const action = 'pdf_settings.update';

        try {
            await setDoc(appMetadataRef, { pdfSettings: settings }, { merge: true });
            toast({ title: "Settings Saved", description: "PDF design settings have been updated." });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Updated PDF design settings.`,
                entity: { type: 'system', id: 'pdf_settings' },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Save PDF Settings Error:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'Could not save the settings.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="h-6 w-6 text-primary" />
                    PDF & Export Design
                </CardTitle>
                <CardDescription>
                    Customize the appearance of generated PDF reports. Company-specific details like name and logo are managed in the <Link href="/dashboard/settings/companies" className="underline font-semibold">Companies</Link> page.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="primaryColor">Primary Color</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="primaryColor"
                                    type="color"
                                    value={settings.primaryColor || '#c97353'}
                                    onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                                    className="w-12 h-10 p-1"
                                />
                                <Input
                                    value={settings.primaryColor || '#c97353'}
                                    onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                                    placeholder="#c97353"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">This color will be used for headers in the PDF report.</p>
                        </div>
                    </div>
                     <div className="space-y-4">
                        <Label>Live Preview</Label>
                        <div className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-4">
                                 <div className="h-[30px] w-[120px] bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">Company Logo</div>
                                <h3 className="font-bold text-lg">Company Name</h3>
                            </div>
                            <div className="space-y-2">
                                 <div className="w-full h-8 rounded-t-md" style={{backgroundColor: settings.primaryColor || '#c97353' }}></div>
                                 <div className="space-y-1 p-2 bg-muted/50 rounded-b-md">
                                    <div className="h-4 w-full bg-muted rounded"></div>
                                    <div className="h-4 w-3/4 bg-muted rounded"></div>
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6">
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
    );
}
