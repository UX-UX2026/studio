import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Check, MessageSquare, Paperclip, Send, User } from "lucide-react";

const approvals = [
  {
    id: "REQ-00124",
    period: "Feb 2026",
    total: 132178.0,
    status: "Pending Executive",
    submittedBy: "Tarryn M.",
    timeline: [
      { stage: "Manager Sign-off", actor: "Tarryn M.", date: "27 Jan 2026", status: "completed" },
      { stage: "Executive Review", actor: "Zukiswa N.", date: null, status: "pending" },
      { stage: "Procurement Ack.", actor: "Linda K.", date: null, status: "waiting" },
    ],
    comments: [
        {actor: "Zukiswa N.", avatarId: 'avatar-1', text: "Can you please double-check the quote for the Cisco router? Seems a bit high.", timestamp: "2 hours ago"}
    ]
  },
  {
    id: "REQ-00123",
    period: "Jan 2026",
    total: 298100.0,
    status: "Completed",
    submittedBy: "Tarryn M.",
    timeline: [
        { stage: "Manager Sign-off", actor: "Tarryn M.", date: "27 Dec 2025", status: "completed" },
        { stage: "Executive Review", actor: "Zukiswa N.", date: "28 Dec 2025", status: "completed" },
        { stage: "Procurement Ack.", actor: "Linda K.", date: "29 Dec 2025", status: "completed" },
    ]
  },
];

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Pending Executive': return <Badge variant="outline" className="text-orange-500 border-orange-500">Pending Executive</Badge>;
        case 'Completed': return <Badge variant="outline" className="text-green-500 border-green-500">Completed</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>
    }
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
};

export default function ApprovalsPage() {
    const activeRequest = approvals[0];
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');

  return (
    <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Approval Workflow: {activeRequest.id}</CardTitle>
                    <CardDescription>{activeRequest.period} Request - {formatCurrency(activeRequest.total)}</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-4">
                        {activeRequest.timeline.map(step => (
                            <li key={step.stage} className="flex items-center gap-4">
                                <div className={`flex items-center justify-center h-10 w-10 rounded-full ${step.status === 'completed' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    {step.status === 'completed' ? <Check className="h-5 w-5" /> : <User className="h-5 w-5"/>}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">{step.stage}</p>
                                    <p className="text-sm text-muted-foreground">{step.actor}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium">{step.date}</p>
                                    <p className={`text-xs font-semibold capitalize ${step.status === 'completed' ? 'text-green-500' : 'text-orange-500'}`}>{step.status}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary"/> Communication Log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        {activeRequest.comments?.map((comment, i) => (
                             <div key={i} className="flex items-start gap-3">
                                <Avatar>
                                    <AvatarImage src={userAvatar?.imageUrl} data-ai-hint={userAvatar?.imageHint}/>
                                    <AvatarFallback>{comment.actor.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 p-3 rounded-lg bg-muted">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{comment.actor}</p>
                                        <p className="text-xs text-muted-foreground">{comment.timestamp}</p>
                                    </div>
                                    <p className="text-sm mt-1">{comment.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="relative">
                        <Textarea placeholder="Respond to queries or add a comment..." className="pr-24"/>
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                            <Button variant="ghost" size="icon"><Paperclip className="h-4 w-4"/></Button>
                            <Button size="icon"><Send className="h-4 w-4"/></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-semibold">All Requests</h3>
             {approvals.map(req => (
                <Card key={req.id} className="hover:bg-muted/50 cursor-pointer transition-colors">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <p className="font-semibold">{req.id}</p>
                            {getStatusBadge(req.status)}
                        </div>
                        <div className="flex justify-between items-end mt-2">
                            <div>
                                <p className="text-xs text-muted-foreground">{req.period}</p>
                                <p className="text-lg font-bold">{formatCurrency(req.total)}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">By: {req.submittedBy}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
