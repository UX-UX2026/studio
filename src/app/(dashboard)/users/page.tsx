'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const mockUsers = [
    { id: '1', name: 'Zukiswa N.', email: 'zukiswa@procurportal.com', role: 'Executive', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxwZW9wbGV8ZW58MHx8fHwxNzE2NDYyOTc5fDA&ixlib=rb-4.0.3&q=80&w=1080' },
    { id: '2', name: 'Tarryn M.', email: 'tarryn@procurportal.com', role: 'Manager', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwyfHxwZW9wbGV8ZW58MHx8fHwxNzE2NDYyOTc5fDA&ixlib=rb-4.0.3&q=80&w=1080' },
    { id: '3', name: 'Linda K.', email: 'linda@procurportal.com', role: 'Procurement Officer', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw0fHxwZW9wbGV8ZW58MHx8fHwxNzE2NDYyOTc5fDA&ixlib=rb-4.0.3&q=80&w=1080' },
    { id: '4', name: 'Admin User', email: 'admin@procurportal.com', role: 'Administrator', avatar: '' },
];

const roles: (string | null)[] = ["Administrator", "Manager", "Procurement Officer", "Executive"];

export default function UsersPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || role !== 'Administrator')) {
            router.push('/');
        }
    }, [user, role, loading, router]);

    if (loading || !user || role !== 'Administrator') {
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
                    <Shield className="h-6 w-6 text-primary" />
                    User & Permission Management
                </CardTitle>
                <CardDescription>
                    Assign roles to users to control their access to different parts of the application.
                    <br />
                    <span className="text-xs text-orange-500 font-medium">Note: Changing roles here is for demonstration. A backend function is required to apply these changes.</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="w-[200px]">Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockUsers.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={u.avatar} />
                                        <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    {u.name}
                                </TableCell>
                                <TableCell>{u.email}</TableCell>
                                <TableCell>
                                    <Select defaultValue={u.role}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Assign role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map(r => r && <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
