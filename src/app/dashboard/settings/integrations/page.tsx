
'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader, Layers, Save, TestTube2, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { logErrorToFirestore } from "@/lib/error-logger";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type OdooConfig = {
    url?: string;
    db?: string;
    username?: string;
    apiKey?: string;
    purchaseOrderModel?: string;
    vendorBillModel?: string;
    vendorModel?: string;
};

type QuickBooksConfig = {
    clientId?: string;
    clientSecret?: string;
    realmId?: string;
};

type XeroConfig = {
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
};

type SageConfig = {
    clientId?: string;
    clientSecret?: string;
};

type AppMetadata = {
    id: string;
    odooConfig?: OdooConfig;
    quickbooksConfig?: QuickBooksConfig;
    xeroConfig?: XeroConfig;
    sageConfig?: SageConfig;
    accountingPlatform?: 'odoo' | 'quickbooks' | 'xero' | 'sage';
};

export default function IntegrationsPage() {
    const { user, role, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const appMetadataRef = useMemo(() => doc(firestore, 'app', 'metadata'), [firestore]);
    const { data: appMetadata, loading: metadataLoading } = useDoc<AppMetadata>(appMetadataRef);

    const [platform, setPlatform] = useState<'odoo' | 'quickbooks' | 'xero' | 'sage'>('odoo');
    const [odooConfig, setOdooConfig] = useState<OdooConfig>({});
    const [quickbooksConfig, setQuickbooksConfig] = useState<QuickBooksConfig>({});
    const [xeroConfig, setXeroConfig] = useState<XeroConfig>({});
    const [sageConfig, setSageConfig] = useState<SageConfig>({});

    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (appMetadata) {
            setPlatform(appMetadata.accountingPlatform || 'odoo');
            setOdooConfig(appMetadata.odooConfig || {});
            setQuickbooksConfig(appMetadata.quickbooksConfig || {});
            setXeroConfig(appMetadata.xeroConfig || {});
            setSageConfig(appMetadata.sageConfig || {});
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
    
    const handleConfigChange = (platform: 'odoo' | 'quickbooks' | 'xero' | 'sage', field: string, value: string) => {
        const setterMap = {
            odoo: setOdooConfig,
            quickbooks: setQuickbooksConfig,
            xero: setXeroConfig,
            sage: setSageConfig,
        };
        setterMap[platform](prev => ({...prev, [field]: value}));
    };

    const handleSaveChanges = async () => {
        if (!user || !firestore) {
            toast({ variant: "destructive", title: "Save failed", description: "Required services are not available." });
            return;
        }

        setIsSaving(true);
        const action = 'integrations.update';

        try {
            await setDoc(appMetadataRef, { 
                accountingPlatform: platform,
                odooConfig,
                quickbooksConfig,
                xeroConfig,
                sageConfig,
            }, { merge: true });
            toast({ title: "Settings Saved", description: "Integration settings have been updated." });
            
            await addDoc(collection(firestore, 'auditLogs'), {
                userId: user.uid,
                userName: user.displayName,
                action: action,
                details: `Updated integration settings for ${platform}.`,
                entity: { type: 'system', id: 'integrations_config' },
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Save Integration Config Error:", error);
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

    const renderPlatformFields = () => {
        switch (platform) {
            case 'odoo':
                return (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Connection Settings</h3>
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="odoo-url">Odoo Instance URL</Label>
                                    <Input
                                        id="odoo-url"
                                        value={odooConfig.url || ''}
                                        onChange={(e) => handleConfigChange('odoo', 'url', e.target.value)}
                                        placeholder="https://your-odoo-domain.com"
                                    />
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="odoo-db">Database Name</Label>
                                        <Input
                                            id="odoo-db"
                                            value={odooConfig.db || ''}
                                            onChange={(e) => handleConfigChange('odoo', 'db', e.target.value)}
                                            placeholder="your_odoo_database"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="odoo-username">Username / Login</Label>
                                        <Input
                                            id="odoo-username"
                                            value={odooConfig.username || ''}
                                            onChange={(e) => handleConfigChange('odoo', 'username', e.target.value)}
                                            placeholder="admin@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="odoo-api-key">API Key or Password</Label>
                                    <Input
                                        id="odoo-api-key"
                                        type="password"
                                        value={odooConfig.apiKey || ''}
                                        onChange={(e) => handleConfigChange('odoo', 'apiKey', e.target.value)}
                                        placeholder="••••••••••••••••"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        It is recommended to use a dedicated API key with limited permissions instead of a user password.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <Separator />

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Model Mappings</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Specify the technical names of the Odoo models to use for synchronization.
                            </p>
                            <div className="space-y-4">
                                 <div className="grid md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="odoo-po-model">Purchase Order Model</Label>
                                        <Input
                                            id="odoo-po-model"
                                            value={odooConfig.purchaseOrderModel || ''}
                                            onChange={(e) => handleConfigChange('odoo', 'purchaseOrderModel', e.target.value)}
                                            placeholder="purchase.order"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="odoo-bill-model">Vendor Bill Model</Label>
                                        <Input
                                            id="odoo-bill-model"
                                            value={odooConfig.vendorBillModel || ''}
                                            onChange={(e) => handleConfigChange('odoo', 'vendorBillModel', e.target.value)}
                                            placeholder="account.move"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="odoo-vendor-model">Vendor Model</Label>
                                    <Input
                                        id="odoo-vendor-model"
                                        value={odooConfig.vendorModel || ''}
                                        onChange={(e) => handleConfigChange('odoo', 'vendorModel', e.target.value)}
                                        placeholder="res.partner"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'quickbooks':
                return (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">QuickBooks Connection</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Enter your QuickBooks App credentials to connect your account. These can be found in your developer dashboard.
                            </p>
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="qb-client-id">Client ID</Label>
                                    <Input
                                        id="qb-client-id"
                                        value={quickbooksConfig.clientId || ''}
                                        onChange={(e) => handleConfigChange('quickbooks', 'clientId', e.target.value)}
                                        placeholder="Your QuickBooks Client ID"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="qb-client-secret">Client Secret</Label>
                                    <Input
                                        id="qb-client-secret"
                                        type="password"
                                        value={quickbooksConfig.clientSecret || ''}
                                        onChange={(e) => handleConfigChange('quickbooks', 'clientSecret', e.target.value)}
                                        placeholder="••••••••••••••••"
                                    />
                                </div>
                                 <div className="grid gap-2">
                                    <Label htmlFor="qb-realm-id">Realm ID (Company ID)</Label>
                                    <Input
                                        id="qb-realm-id"
                                        value={quickbooksConfig.realmId || ''}
                                        onChange={(e) => handleConfigChange('quickbooks', 'realmId', e.target.value)}
                                        placeholder="Your Company ID"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        This is usually available after the initial OAuth connection.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 border-l-4 border-blue-500 bg-blue-500/10">
                            <div className="flex-1">
                                <h4 className="font-semibold">Connect to QuickBooks</h4>
                                <p className="text-sm text-muted-foreground">
                                    You will be redirected to QuickBooks to authorize the connection.
                                </p>
                            </div>
                            <Button disabled>Connect (Coming Soon)</Button>
                        </div>
                    </div>
                );
            case 'xero':
                 return (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Xero Connection</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Enter your Xero App credentials to connect your account.
                            </p>
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="xero-client-id">Client ID</Label>
                                    <Input
                                        id="xero-client-id"
                                        value={xeroConfig.clientId || ''}
                                        onChange={(e) => handleConfigChange('xero', 'clientId', e.target.value)}
                                        placeholder="Your Xero Client ID"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="xero-client-secret">Client Secret</Label>
                                    <Input
                                        id="xero-client-secret"
                                        type="password"
                                        value={xeroConfig.clientSecret || ''}
                                        onChange={(e) => handleConfigChange('xero', 'clientSecret', e.target.value)}
                                        placeholder="••••••••••••••••"
                                    />
                                </div>
                                 <div className="grid gap-2">
                                    <Label htmlFor="xero-tenant-id">Tenant ID</Label>
                                    <Input
                                        id="xero-tenant-id"
                                        value={xeroConfig.tenantId || ''}
                                        onChange={(e) => handleConfigChange('xero', 'tenantId', e.target.value)}
                                        placeholder="Your Xero Tenant ID"
                                    />
                                     <p className="text-xs text-muted-foreground">
                                        This is available after the initial OAuth connection.
                                    </p>
                                </div>
                            </div>
                        </div>
                         <div className="flex items-center gap-4 p-4 border-l-4 border-blue-500 bg-blue-500/10">
                            <div className="flex-1">
                                <h4 className="font-semibold">Connect to Xero</h4>
                                <p className="text-sm text-muted-foreground">
                                    You will be redirected to Xero to authorize the connection.
                                </p>
                            </div>
                            <Button disabled>Connect (Coming Soon)</Button>
                        </div>
                    </div>
                );
            case 'sage':
                return (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Sage Accounting Connection</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Enter your Sage App credentials to connect your account.
                            </p>
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="sage-client-id">Client ID</Label>
                                    <Input
                                        id="sage-client-id"
                                        value={sageConfig.clientId || ''}
                                        onChange={(e) => handleConfigChange('sage', 'clientId', e.target.value)}
                                        placeholder="Your Sage Client ID"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="sage-client-secret">Client Secret</Label>
                                    <Input
                                        id="sage-client-secret"
                                        type="password"
                                        value={sageConfig.clientSecret || ''}
                                        onChange={(e) => handleConfigChange('sage', 'clientSecret', e.target.value)}
                                        placeholder="••••••••••••••••"
                                    />
                                </div>
                            </div>
                        </div>
                         <div className="flex items-center gap-4 p-4 border-l-4 border-blue-500 bg-blue-500/10">
                            <div className="flex-1">
                                <h4 className="font-semibold">Connect to Sage</h4>
                                <p className="text-sm text-muted-foreground">
                                    You will be redirected to Sage to authorize the connection.
                                </p>
                            </div>
                            <Button disabled>Connect (Coming Soon)</Button>
                        </div>
                    </div>
                );
        }
    }


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="h-6 w-6 text-primary" />
                        Accounting Integrations
                    </CardTitle>
                    <CardDescription>
                        Configure connections to your online accounting platforms to synchronize financial data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <div>
                        <Label htmlFor="platform-select">Select Platform</Label>
                        <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
                            <SelectTrigger id="platform-select" className="w-[280px] mt-2">
                                <SelectValue placeholder="Select an accounting platform" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="odoo">Odoo</SelectItem>
                                <SelectItem value="quickbooks">QuickBooks</SelectItem>
                                <SelectItem value="xero">Xero</SelectItem>
                                <SelectItem value="sage">Sage</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator />
                    {renderPlatformFields()}
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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-primary" />
                        Query Engine
                    </CardTitle>
                    <CardDescription>
                        This is a placeholder for a future feature that will allow you to build and test direct queries against the selected platform's API.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Label htmlFor="query-textarea">API Query</Label>
                        <Textarea 
                            id="query-textarea"
                            placeholder={`// Example for Odoo: Search for vendors in a specific city\n{\n  "model": "${odooConfig.vendorModel || 'res.partner'}",\n  "method": "search_read",\n  "args": [[["city", "=", "Port Elizabeth"]]],\n  "kwargs": {\n    "fields": ["name", "email", "phone"]\n  }\n}`}
                            rows={8}
                            className="font-mono text-xs"
                            disabled
                        />
                        <Button disabled>Run Query</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
