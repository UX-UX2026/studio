'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/firebase/auth/use-user";
import { LifeBuoy, FileText, PenLine, ClipboardCheck, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const rolesData = [
    { role: "Administrator", description: "Has unrestricted access to all features, settings, and data. Responsible for system configuration, user management, and overall oversight." },
    { role: "Requester", description: "The primary role for initiating procurement. Can create, save, and submit procurement requests for their assigned department." },
    { role: "Manager", description: "The first line of approval. Can review, approve, reject, or raise queries on requests submitted by users within their department." },
    { role: "Executive", description: "Provides a higher level of approval, typically for high-value requests, after they have been approved by a manager." },
    { role: "Procurement Officer / Assistant", description: "Manages the entire fulfillment process for approved requests, including sourcing from vendors, tracking orders, and logging received goods." },
];

const featuresData = [
    { 
        feature: "Procurement & Submission", 
        icon: FileText,
        description: "The 'Quick Submit' page is your starting point for all procurement activities.",
        guide: [
            "1. **Select Department & Period**: Choose the department and the month for your submission.",
            "2. **Automated Items**: Notice that recurring monthly items (like subscriptions) are automatically added for you.",
            "3. **Add Items**: Click 'Add Item' to create a new line item. Fill in the description, category, quantity, and unit price.",
            "4. **Save Draft**: You can click 'Save as Draft' at any time to save your progress and return later. Find your drafts on the main dashboard.",
            "5. **Submit for Approval**: Once you've added all your items, click 'Submit For Approval'. If you are a Requester, you can use the 'Notify Manager' button to send an email notification."
        ]
    },
    { 
        feature: "Approval Workflow", 
        icon: PenLine,
        description: "The 'Approvals' page is where requests are reviewed and actioned.",
        guide: [
            "1. **Select a Request**: Click on a request from the list to view its details.",
            "2. **Review Details**: The expanded view shows the approval timeline, line items, and a budget summary.",
            "3. **Take Action**: Use the buttons at the bottom of the card to 'Approve', 'Reject', or 'Raise Query'.",
            "4. **Communicate**: Queries and rejection reasons are logged in the 'Communication Log' tab, ensuring transparency.",
            "5. **Export**: Once a request is approved, you can export a detailed report in PDF or Excel format using the 'Export Report' button."
        ]
    },
    { 
        feature: "Fulfillment Management", 
        icon: ClipboardCheck,
        description: "The 'Fulfillment' page is for tracking the delivery of approved items.",
        guide: [
            "1. **View Items**: All items from 'In Fulfillment' requests are listed here, grouped by department.",
            "2. **Update Status**: For each item, you can update the fulfillment status (Sourcing, Quoted, Ordered, Completed).",
            "3. **Log Quantities**: As items arrive, update the 'Rcvd Qty' (Received Quantity) field.",
            "4. **Add Comments**: Use the 'Comments' button to add notes about the fulfillment process for a specific item.",
            "5. **Automatic Completion**: When all items in a request are marked as 'Completed', the request itself will automatically be marked as 'Completed'."
        ]
    },
     { 
        feature: "System Administration", 
        icon: Settings,
        description: "The 'Settings' area contains powerful tools for administrators to configure the application.",
        guide: [
            "• **User Management**: Create users, assign roles, and manage department associations.",
            "• **Workflow**: Customize the approval stages and permissions for each department.",
            "• **Budget Integration**: Import departmental budget forecasts from CSV files.",
            "• **Audit & Error Logs**: Monitor all significant user actions and track application errors.",
            "• **Data Management**: Export backups of all data or perform system-wide data clearing operations."
        ]
    },
];

const techStack = [
    { item: "Frontend Framework", value: "Next.js with React (App Router)" },
    { item: "Language", value: "TypeScript" },
    { item: "Styling", value: "Tailwind CSS with ShadCN UI" },
    { item: "Database", value: "Cloud Firestore (NoSQL)" },
    { item: "Authentication", value: "Firebase Authentication" },
    { item: "Hosting", value: "Configured for Vercel or Firebase Hosting" },
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
    { path: "/app/metadata", description: "A single document for storing global application settings." },
];


export default function HelpPage() {
    const { role } = useUser();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LifeBuoy className="h-6 w-6 text-primary" />
                    Help & Documentation
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
                                <AccordionTrigger className="text-lg font-semibold">How-To Guides</AccordionTrigger>
                                <AccordionContent>
                                    <p className="mb-4 text-muted-foreground">Step-by-step guides for the application's core features.</p>
                                    <div className="space-y-4">
                                        {featuresData.map(f => (
                                            <div key={f.feature} className="p-4 border rounded-md">
                                                <h4 className="font-semibold flex items-center gap-2 text-md mb-2">
                                                    <f.icon className="h-5 w-5 text-primary" />
                                                    {f.feature}
                                                </h4>
                                                <p className="text-sm text-muted-foreground mb-3">{f.description}</p>
                                                <ul className="space-y-2 text-sm list-inside">
                                                    {f.guide.map((step, i) => (
                                                        <li key={i} className="flex items-start">
                                                            <span className="mr-2 text-primary font-semibold">•</span>
                                                            <span>{step}</span>
                                                        </li>
                                                    ))}
                                                </ul>
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
