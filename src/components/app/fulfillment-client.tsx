"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader, MessageSquare, BellRing, Send, User, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { type UserRole, useUser } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { ApprovalRequest, FulfillmentItem } from "@/types";
import { logErrorToFirestore } from "@/lib/error-logger";
import { cn } from "@/lib/utils";

const fulfillmentStatuses = ["Sourcing", "Quoted", "Ordered", "Completed"];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Sourcing":
      return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">{status}</Badge>;
    case "Quoted":
      return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">{status}</Badge>;
    case "Ordered":
      return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">{status}</Badge>;
    case "Completed":
      return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">{status}</Badge>;
    default:
      return <Badge variant="secondary" className="bg-gray-50">{status || 'Pending'}</Badge>;
  }
};

export function FulfillmentClient({ items: initialItems, role }: { items: FulfillmentItem[], role: UserRole }) {
  const { user, profile } = useUser();
  const [items, setItems] = useState(initialItems);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const isProcurement = role === 'Procurement Assistant' || role === 'Procurement Officer' || role === 'Administrator';
  const isRequesterOrManager = role === 'Requester' || role === 'Manager';

  const handleItemUpdate = async (itemId: string | number, field: keyof FulfillmentItem, value: any) => {
      const itemToUpdate = items.find(i => i.id === itemId);
      if (!itemToUpdate || !firestore || !user || !profile) return;
      
      setIsSubmitting(true);
      const requestRef = doc(firestore, 'procurementRequests', itemToUpdate.procurementRequestId);
      const action = 'fulfillment.update';

      try {
          const requestSnap = await getDoc(requestRef);
          if (!requestSnap.exists()) throw new Error("Procurement request not found");
          
          let requestData = requestSnap.data() as ApprovalRequest;
          
          const updatedItems = requestData.items.map(i => {
              if (i.id === itemId) {
                  return { ...i, [field]: value };
              }
              return i;
          });

          const allItemsCompleted = updatedItems.every(item => item.fulfillmentStatus === 'Completed');
          const updatePayload: Partial<ApprovalRequest> = { items: updatedItems };

          if (allItemsCompleted && requestData.status !== 'Completed') {
              updatePayload.status = 'Completed';
              updatePayload.updatedAt = serverTimestamp() as any;

              const currentDate = new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
              const actorName = `${profile?.displayName || user?.email || 'User'} (System)`;
              
              updatePayload.timeline = requestData.timeline.map(step => {
                  if (step.stage === 'In Fulfillment' || step.stage === 'Completed') {
                      return { ...step, status: 'completed' as const, date: currentDate, actor: actorName };
                  }
                  return step;
              });
      
              toast({ title: "Request Finalized", description: `Auto-completed based on line item delivery.` });
          }
          
          await updateDoc(requestRef, updatePayload);

          setItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
          toast({ title: "Status Updated" });

          await addDoc(collection(firestore, 'auditLogs'), {
            userId: user.uid,
            userName: `${profile.displayName} (${role})`,
            action,
            details: `Updated ${String(field)} for ${itemToUpdate.item}`,
            entity: { type: 'procurementRequest', id: itemToUpdate.procurementRequestId },
            timestamp: serverTimestamp()
          });
      } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
            await logErrorToFirestore(firestore, { userId: user.uid, userName: profile.displayName, action, errorMessage: error.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handlePing = async (item: FulfillmentItem) => {
      if (!user || !profile || !firestore) return;
      
      const pingText = `FOLLOW-UP REQUEST: ${profile.displayName} (${role}) requested an update on this item.`;
      const updatedComments = [...(item.fulfillmentComments || []), `[PING] ${new Date().toLocaleString()}: ${pingText}`];
      
      try {
          await handleItemUpdate(item.id, 'fulfillmentComments', updatedComments);
          toast({ title: "Procurement Pinged", description: "The team has been notified of your follow-up request." });
          
          await addDoc(collection(firestore, 'auditLogs'), {
            userId: user.uid,
            userName: profile.displayName,
            action: 'fulfillment.ping',
            details: `Pinged procurement for item: ${item.item}`,
            entity: { type: 'procurementRequest', id: item.procurementRequestId },
            timestamp: serverTimestamp()
          });
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Ping Failed', description: error.message });
      }
  };

  return (
    <>
      <div className="overflow-auto border rounded-lg shadow-sm bg-background">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Item Description</TableHead>
              <TableHead className="w-[100px] text-center font-bold">Qty</TableHead>
              <TableHead className="w-[100px] text-center font-bold">Rcvd</TableHead>
              <TableHead className="w-[120px] font-bold text-center">Status</TableHead>
              <TableHead className="w-[120px] font-bold text-center">Est. Days</TableHead>
              <TableHead className="text-right font-bold pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const outstanding = item.qty - (item.receivedQty || 0);
              const isUrgent = outstanding > 0 && item.fulfillmentStatus !== 'Completed';
              
              return (
                <TableRow key={item.id} className={cn("transition-colors", isUrgent ? "bg-red-50/5" : "")}>
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{item.item}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight">REQ: {item.procurementRequestId.substring(0,8)}... • Approved: {item.approvedOn}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{item.qty}</TableCell>
                  <TableCell>
                      <Input
                          type="number"
                          value={item.receivedQty || 0}
                          onChange={(e) => handleItemUpdate(item.id, 'receivedQty', parseInt(e.target.value) || 0)}
                          className="w-16 h-8 mx-auto text-center font-mono"
                          disabled={!isProcurement || isSubmitting}
                      />
                  </TableCell>
                  <TableCell className="text-center">
                      {isProcurement ? (
                           <Select value={item.fulfillmentStatus || 'Pending'} onValueChange={(v) => handleItemUpdate(item.id, 'fulfillmentStatus', v)}>
                              <SelectTrigger className="h-8 w-[110px] mx-auto text-xs font-semibold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fulfillmentStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      ) : (
                          getStatusBadge(item.fulfillmentStatus)
                      )}
                  </TableCell>
                  <TableCell>
                    <Input
                        type="number"
                        value={item.estimatedLeadTimeDays || ''}
                        onChange={(e) => handleItemUpdate(item.id, 'estimatedLeadTimeDays', parseInt(e.target.value, 10))}
                        className="w-16 h-8 mx-auto text-center text-xs"
                        disabled={!isProcurement || isSubmitting}
                        placeholder="--"
                    />
                  </TableCell>
                  <TableCell className="text-right pr-6 space-x-2 whitespace-nowrap">
                    {isRequesterOrManager && item.fulfillmentStatus !== 'Completed' && (
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => handlePing(item)}>
                            <BellRing className="h-4 w-4 mr-1" />
                            Ping
                        </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { setSelectedItem(item); setIsCommentDialogOpen(true); }}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {item.fulfillmentComments?.length || 0}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Fulfillment Log: {selectedItem?.item}
                  </DialogTitle>
                  <DialogDescription>Internal communication and delivery notes for this line item.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {selectedItem?.fulfillmentComments && selectedItem.fulfillmentComments.length > 0 ? (
                        selectedItem.fulfillmentComments.map((c, i) => {
                            const isPing = c.startsWith('[PING]');
                            return (
                                <div key={i} className={cn("p-3 rounded-lg text-sm", isPing ? "bg-orange-50 border border-orange-100 text-orange-900" : "bg-muted border border-border")}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {isPing ? <BellRing className="h-3 w-3" /> : <User className="h-3 w-3 text-muted-foreground" />}
                                        <span className="font-bold text-[10px] uppercase">{isPing ? 'Priority Alert' : 'Log Entry'}</span>
                                    </div>
                                    <p className="leading-relaxed">{isPing ? c.replace('[PING] ', '') : c}</p>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-40">
                            <MessageSquare className="h-8 w-8 mb-2" />
                            <p>No comments recorded yet.</p>
                        </div>
                    )}
                </div>
                {isProcurement && (
                    <div className="space-y-2 pt-2 border-t">
                        <Label htmlFor="comment" className="text-xs font-bold uppercase text-muted-foreground">Add New Entry</Label>
                        <div className="relative">
                            <Textarea 
                                id="comment" 
                                placeholder="Log delivery updates, vendor issues, or tracking numbers..." 
                                value={newComment} 
                                onChange={e => setNewComment(e.target.value)}
                                className="min-h-[80px] pr-12 text-sm"
                            />
                            <Button 
                                size="icon" 
                                className="absolute bottom-2 right-2 h-8 w-8" 
                                onClick={async () => {
                                    if (!selectedItem || !newComment.trim()) return;
                                    const entry = `${profile?.displayName} (${role}): ${newComment}`;
                                    const updated = [...(selectedItem.fulfillmentComments || []), entry];
                                    await handleItemUpdate(selectedItem.id, 'fulfillmentComments', updated);
                                    setNewComment("");
                                }}
                                disabled={isSubmitting}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCommentDialogOpen(false)}>Close</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
