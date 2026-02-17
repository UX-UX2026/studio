import { SubmissionClient } from "@/components/app/submission-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SubmissionPage() {
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
