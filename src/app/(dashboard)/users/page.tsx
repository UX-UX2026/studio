'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { mockUsers } from "@/lib/users-mock-data";
import { mockDepartments } from "@/lib/departments-mock-data";


const roles: (string | null)[] = ["Administrator", "Manager", "Procurement Officer", "Executive"];
const departments = mockDepartments.map(d => d.name);

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
                            <TableHead className="w-[200px]">Department</TableHead>
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
                                <TableCell>
                                    <Select defaultValue={u.department}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Assign department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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
