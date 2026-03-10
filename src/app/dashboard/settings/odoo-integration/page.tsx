'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Layers, Save, TestTube2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";

type OdooConfig = {
    url?: string;
    db?: string;
    username?: string;
    apiKey?: string;
};

type AppMetadata = {
    id: string;
    odooConfig?: OdooConfig;
};

export default function OdooIntegrationPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const [config, setConfig] = useState<OdooConfig>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (appMetadata?.odooConfig) {
            setConfig(appMetadata.odooConfig);
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
    
    const handleConfigChange = (field: keyof OdooConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveChanges = async () => {
        if (!user || !firestore) {
            toast({ variant: "destructive", title: "Save failed", description: "Required services are not available." });
            return;
        }

        setIsSaving(true);
        const action = 'odoo_integration.update';

        try {
            await setDoc(appMetadataRef, { odooConfig: config }, { merge: true });
            toast({ title: "Settings Saved", description: "Odoo integration settings have been updated." });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Updated Odoo integration settings.`,
                entity: { type: 'system', id: 'odoo_config' },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Save Odoo Config Error:", error);
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
    
    const handleTestConnection = () => {
        setIsTesting(true);
        toast({
            title: 'Testing Connection...',
            description: 'This is a placeholder. No real connection test is performed.',
        });
        setTimeout(() => {
            setIsTesting(false);
            toast({
                variant: 'default',
                title: 'Test Complete',
                description: 'Placeholder test finished successfully.',
            });
        }, 2000);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Layers className="h-6 w-6 text-primary" />
                    Odoo Integration Settings
                </CardTitle>
                <CardDescription>
                    Configure the connection to your Odoo instance. This information will be used to synchronize financial data like invoices and vendor bills.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="odoo-url">Odoo Instance URL</Label>
                        <Input
                            id="odoo-url"
                            value={config.url || ''}
                            onChange={(e) => handleConfigChange('url', e.target.value)}
                            placeholder="https://your-odoo-domain.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="odoo-db">Database Name</Label>
                        <Input
                            id="odoo-db"
                            value={config.db || ''}
                            onChange={(e) => handleConfigChange('db', e.target.value)}
                            placeholder="your_odoo_database"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="odoo-username">Username / Login</Label>
                        <Input
                            id="odoo-username"
                            value={config.username || ''}
                            onChange={(e) => handleConfigChange('username', e.target.value)}
                            placeholder="admin@example.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="odoo-api-key">API Key or Password</Label>
                        <Input
                            id="odoo-api-key"
                            type="password"
                            value={config.apiKey || ''}
                            onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                            placeholder="••••••••••••••••"
                        />
                         <p className="text-xs text-muted-foreground">
                            It is recommended to use a dedicated API key with limited permissions instead of a user password.
                        </p>
                    </div>
                </div>
            </CardContent>
             <CardFooter className="flex justify-end gap-2 border-t pt-6">
                 <Button variant="outline" onClick={handleTestConnection} disabled={isSaving || isTesting}>
                    {isTesting ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <TestTube2 className="mr-2 h-4 w-4" />}
                    Test Connection
                </Button>
                <Button onClick={handleSaveChanges} disabled={isSaving || isTesting}>
                    {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
    );
}
