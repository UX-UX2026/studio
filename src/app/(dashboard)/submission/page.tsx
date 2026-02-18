'use client';

import { useUser } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { SubmissionClient } from "@/components/app/submission-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SubmissionPage() {
    const { user, role, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
      if (!loading && (!user || (role !== 'Manager' && role !== 'Administrator'))) {
        router.push('/');
      }
    }, [user, role, loading, router]);

    if (loading || !user || (role !== 'Manager' && role !== 'Administrator')) {
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
        <SubmissionClient />
      </CardContent>
    </Card>
  );
}
