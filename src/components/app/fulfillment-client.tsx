

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
import { Loader, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { type UserRole, useUser } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { ApprovalRequest, ApprovalItem } from "@/lib/approvals-mock-data";
import { logErrorToFirestore } from "@/lib/error-logger";


type FulfillmentItem = ApprovalItem & {
  procurementRequestId: string;
  department: string;
  item: string; // This is item.description
  approvedOn: string;
  request: any;
  submittedBy: string;
};

const fulfillmentStatuses = ["Sourcing", "Quoted", "Ordered", "Completed"];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Sourcing":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{status}</Badge>;
    case "Quoted":
      return <Badge variant="outline" className="text-blue-500 border-blue-500">{status}</Badge>;
    case "Ordered":
      return <Badge variant="outline" className="text-purple-500 border-purple-500">{status}</Badge>;
    case "Completed":
      return <Badge variant="outline" className="text-green-500 border-green-500">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export function FulfillmentClient({ items: initialItems, role }: { items: FulfillmentItem[], role: UserRole }) {
  const { user, profile } = useUser();
  const [items, setItems] = useState(initialItems);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();
  const firestore = useFirestore();

  const canEdit = role === 'Procurement Assistant' || role === 'Procurement Officer' || role === 'Administrator';

  
  const handleItemUpdate = async (itemId: string | number, field: keyof FulfillmentItem, value: any) => {
      const itemToUpdate = items.find(i => i.id === itemId);
      if (!itemToUpdate || !firestore || !user || !profile) return;
      
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
              
              const newTimeline = requestData.timeline.map(step => {
                  if (step.stage === 'In Fulfillment' || step.stage === 'Completed') {
                      return {
                          ...step,
                          status: 'completed' as const,
                          date: currentDate,
                          actor: actorName,
                      };
                  }
                  return step;
              });
      
              updatePayload.timeline = newTimeline;

              toast({ title: "Request Completed", description: `Request ${itemToUpdate.procurementRequestId} automatically marked as complete.` });
          }
          
          await updateDoc(requestRef, updatePayload);

          toast({ title: "Fulfillment item updated." });

          // Also update local state for immediate UI feedback
          setItems(currentItems =>
              currentItems.map(item =>
                  item.id === itemId ? { ...item, [field]: value } : item
              )
          );

          const auditLogData = {
            userId: user.uid,
            userName: `${profile.displayName || user.email} (${role})`,
            action: action,
            details: `Updated field '${String(field)}' to '${value}' for item '${itemToUpdate.item}'`,
            entity: { type: 'procurementRequest', id: itemToUpdate.procurementRequestId },
            timestamp: serverTimestamp()
          };

          await addDoc(collection(firestore, 'auditLogs'), auditLogData);
      } catch (error: any) {
            console.error("Fulfillment Update Error:", error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || 'Could not update the fulfillment item. Check your connection.',
            });
            await logErrorToFirestore(firestore, {
                userId: user.uid,
                userName: `${profile?.displayName || user.email} (${role})`,
                action,
                errorMessage: error.message,
                errorStack: error.stack,
            });
      }
  };
  
  const handleOpenCommentDialog = (item: FulfillmentItem) => {
      setSelectedItem(item);
      setIsCommentDialogOpen(true);
  };

  const handleAddComment = () => {
      if (!selectedItem || !newComment.trim() || !role || !profile || !user) return;

      const newCommentText = `${profile.displayName || user.email} (${role}): ${newComment}`;
      const updatedComments = [...(selectedItem.fulfillmentComments || []), newCommentText];
      
      handleItemUpdate(selectedItem.id, 'fulfillmentComments', updatedComments);

      setNewComment("");
      setIsCommentDialogOpen(false);
      setSelectedItem(null);
  };

  return (
    <>
      <div className="overflow-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Total Qty</TableHead>
              <TableHead>Rcvd Qty</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Est. Lead Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const outstandingQty = item.qty - (item.receivedQty || 0);
              return (
                <TableRow key={item.id} className={outstandingQty > 0 && item.approvedOn > '10' ? "bg-red-500/10" : ""}>
                  <TableCell className="font-medium">{item.item}</TableCell>
                  <TableCell>{item.submittedBy}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>
                      <Input
                          type="number"
                          value={item.receivedQty || 0}
                          onChange={(e) => handleItemUpdate(item.id, 'receivedQty', parseInt(e.target.value) || 0)}
                          className="w-20"
                          disabled={!canEdit}
                      />
                  </TableCell>
                  <TableCell className={outstandingQty > 0 ? 'font-bold' : ''}>{outstandingQty}</TableCell>
                  <TableCell>
                    <Input
                        type="number"
                        value={item.estimatedLeadTimeDays || ''}
                        onChange={(e) => handleItemUpdate(item.id, 'estimatedLeadTimeDays', parseInt(e.target.value, 10))}
                        className="w-24"
                        disabled={!canEdit}
                        placeholder="Days..."
                    />
                  </TableCell>
                  <TableCell>
                      {canEdit ? (
                           <Select value={item.fulfillmentStatus} onValueChange={(value) => handleItemUpdate(item.id, 'fulfillmentStatus', value)}>
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fulfillmentStatuses.map(status => (
                                  <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                              </SelectContent>
                          </Select>
                      ) : (
                          getStatusBadge(item.fulfillmentStatus)
                      )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCommentDialog(item)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Comments ({item.fulfillmentComments?.length || 0})
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
          <DialogContent className="flex flex-col max-h-[90dvh]">
              <DialogHeader>
                  <DialogTitle>Feedback for {selectedItem?.item}</DialogTitle>
                  <DialogDescription>View history and add new comments.</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-4">
                    {selectedItem?.fulfillmentComments && selectedItem.fulfillmentComments.length > 0 ? (
                        selectedItem.fulfillmentComments.map((comment, index) => (
                             <div key={index} className="text-sm p-3 rounded-md bg-muted">{comment}</div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                    )}
                </div>
                <div className="grid gap-2 pt-4">
                    <Label htmlFor="comment">Add Comment</Label>
                    <Textarea id="comment" value={newComment} onChange={e => setNewComment(e.target.value)} disabled={!canEdit}/>
                </div>
              </div>
              <DialogFooter className="border-t pt-4">
                  <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddComment} disabled={!canEdit}>Save Comment</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
