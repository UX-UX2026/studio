'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/firebase/auth/use-user";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

// Data extracted from README.md and project structure
const rolesData = [
    { role: "Administrator", description: "Full access to all features, settings, and data. Manages users, departments, and system configurations." },
    { role: "Requester", description: "Can create and submit procurement requests for their assigned department." },
    { role: "Manager", description: "Can approve or reject requests submitted by users in their department." },
    { role: "Executive", description: "Has higher-level approval authority, typically for high-value requests, after a manager's approval." },
    { role: "Procurement Officer / Assistant", description: "Manages the fulfillment process for approved requests, interacts with vendors, and tracks item delivery." },
];

const featuresData = [
    { feature: "Quick Submit", description: "A centralized page for creating and managing procurement requests, with support for adding recurring items and importing from CSV." },
    { feature: "Approval Workflow", description: "A multi-stage approval pipeline (e.g., Manager Review -> Executive Approval). Approvers can review line items, see request history, and add comments or queries." },
    { feature: "Fulfillment Management", description: "A dedicated dashboard for procurement officers to manage approved requests, track item status (Sourcing, Quoted, Ordered, Completed), and log received quantities." },
    { feature: "System Administration", description: "A suite of tools for Administrators to manage users, departments, budgets, workflows, and view system logs." },
    { feature: "Digital Fingerprints", description: "Every approval and rejection is secured with a unique SHA-256 cryptographic hash of the request data. This 'digital fingerprint' provides a tamper-evident audit trail, ensuring data integrity throughout the workflow." },
];

const techStack = [
    { item: "Frontend Framework", value: "Next.js with React (App Router)" },
    { item: "Language", value: "TypeScript" },
    { item: "Styling", value: "Tailwind CSS with ShadCN UI" },
    { item: "Database", value: "Cloud Firestore (NoSQL)" },
    { item: "Authentication", value: "Firebase Authentication" },
    { item: "Hosting", value: "Firebase Hosting" },
];

const dbSchema = [
    { path: "/users/{userId}", description: "Stores public profile information for each user." },
    { path: "/departments/{departmentId}", description: "Contains all departments, their budgets, and custom workflows." },
    { path: "/roles/{roleId}", description: "Defines all user roles and their specific permission sets." },
    { path: "/procurementRequests/{procurementRequestId}", description: "The core collection for all procurement submissions." },
    { path: "/vendors/{vendorId}", description: "A list of all approved vendors and suppliers." },
    { path: "/recurringItems/{recurringItemId}", description: "Master list of automatically-added recurring procurement items." },
    { path: "/budgetUploads/{uploadId}", description: "Stores all imported budget versions, linked to a department." },
    { path: "/budgets/{budgetId}", description: "Stores individual budget line items from an imported forecast." },
    { path: "/auditLogs/{logId}", description: "A complete log of all significant user actions for security and tracking." },
    { path: "/errorLogs/{errorLogId}", description: "A log of all client-side application errors for debugging purposes." },
];


export default function HelpPage() {
    const { role } = useUser();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LifeBuoy className="h-6 w-6 text-primary" />
                    Help Center
                </CardTitle>
                <CardDescription>
                    Guides and information to help you use the Procurement Portal effectively.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="user-guide">
                    <TabsList className={cn("grid w-full", role === 'Administrator' ? "grid-cols-2" : "grid-cols-1")}>
                        <TabsTrigger value="user-guide">User Guide</TabsTrigger>
                        {role === 'Administrator' && (
                            <TabsTrigger value="system-guide">System & Admin Guide</TabsTrigger>
                        )}
                    </TabsList>
                    
                    <TabsContent value="user-guide" className="pt-6">
                        <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full space-y-4">
                            <AccordionItem value="item-1">
                                <AccordionTrigger className="text-lg font-semibold">User Roles & Responsibilities</AccordionTrigger>
                                <AccordionContent>
                                    <p className="mb-4 text-muted-foreground">The application's functionality is determined by your assigned role. Here is an overview of the primary roles:</p>
                                    <div className="space-y-3">
                                        {rolesData.map(r => (
                                            <div key={r.role} className="p-3 border rounded-md">
                                                <h4 className="font-semibold">{r.role}</h4>
                                                <p className="text-sm text-muted-foreground">{r.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger className="text-lg font-semibold">Core Features Overview</AccordionTrigger>
                                <AccordionContent>
                                    <p className="mb-4 text-muted-foreground">Key features that streamline the procurement lifecycle.</p>
                                    <div className="space-y-3">
                                        {featuresData.map(f => (
                                            <div key={f.feature} className="p-3 border rounded-md">
                                                <h4 className="font-semibold">{f.feature}</h4>
                                                <p className="text-sm text-muted-foreground">{f.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </TabsContent>
                    
                    {role === 'Administrator' && (
                        <TabsContent value="system-guide" className="pt-6">
                            <Accordion type="multiple" defaultValue={['item-3', 'item-4']} className="w-full space-y-4">
                                <AccordionItem value="item-3">
                                    <AccordionTrigger className="text-lg font-semibold">Technical Stack</AccordionTrigger>
                                    <AccordionContent>
                                        <p className="mb-4 text-muted-foreground">The application is built on the following modern technologies.</p>
                                        <div className="overflow-auto rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Component</TableHead>
                                                        <TableHead>Technology</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {techStack.map(t => (
                                                        <TableRow key={t.item}>
                                                            <TableCell className="font-medium">{t.item}</TableCell>
                                                            <TableCell>{t.value}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-4">
                                    <AccordionTrigger className="text-lg font-semibold">Database Schema</AccordionTrigger>
                                    <AccordionContent>
                                        <p className="mb-4 text-muted-foreground">The Firestore database is structured into several top-level collections.</p>
                                        <div className="overflow-auto rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Collection Path</TableHead>
                                                        <TableHead>Description</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {dbSchema.map(s => (
                                                        <TableRow key={s.path}>
                                                            <TableCell className="font-medium font-mono text-sm">{s.path}</TableCell>
                                                            <TableCell>{s.description}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </TabsContent>
                    )}
                </Tabs>
            </CardContent>
        </Card>
    );
}
