'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { SubmissionClient } from "@/components/app/submission-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SubmissionPage() {
    const { user, role, department, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      const allowedRoles = ['Manager', 'Administrator', 'Requester', 'Executive'];
      if (loading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }
      if (role && !allowedRoles.includes(role)) {
        router.push('/dashboard');
      }
    }, [user, role, loading, router]);

    const allowedRoles = useMemo(() => ['Manager', 'Administrator', 'Requester', 'Executive'], []);
    if (loading || !user || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
  return (
    <Card>
      <CardHeader>
        <CardTitle>Period Procurement Submission</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create and manage your procurement request for the selected period.
          Recurring items are automatically included.
        </p>
      </CardHeader>
      <CardContent>
        <SubmissionClient userRole={role} userDepartment={department}/>
      </CardContent>
    </Card>
  );
}
