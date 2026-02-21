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
import { Wand2, Loader, CheckCircle, Truck, ShoppingCart, MessageSquare } from "lucide-react";
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
import type { RecommendFulfillmentStrategyInput, RecommendFulfillmentStrategyOutput } from "@/ai/flows/recommend-fulfillment-strategy";
import { recommendFulfillmentStrategy } from "@/ai/flows/recommend-fulfillment-strategy";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { type UserRole, useUser } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { ApprovalRequest, ApprovalItem } from "@/lib/approvals-mock-data";


type FulfillmentItem = ApprovalItem & {
  procurementRequestId: string;
  department: string;
  item: string; // This is item.description
  approvedOn: string;
  request: any;
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
  const { user } = useUser();
  const [items, setItems] = useState(initialItems);
  const [isRecommendDialogOpen, setIsRecommendDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendFulfillmentStrategyOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();
  const firestore = useFirestore();

  const canEdit = role === 'Procurement Assistant' || role === 'Procurement Officer' || role === 'Administrator';

  const handleRecommendClick = async (item: FulfillmentItem) => {
    setSelectedItem(item);
    setIsRecommendDialogOpen(true);
    setIsLoading(true);
    setRecommendation(null);

    try {
      const result = await recommendFulfillmentStrategy(item.request as RecommendFulfillmentStrategyInput);
      setRecommendation(result);
       if (result.estimatedLeadTimeDays) {
          // This will update firestore and the local state
          await handleItemUpdate(item.id, 'estimatedLeadTimeDays', result.estimatedLeadTimeDays);
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "AI Recommendation Failed",
        description: "Could not fetch fulfillment strategy.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleItemUpdate = async (itemId: string | number, field: keyof FulfillmentItem, value: any) => {
      const itemToUpdate = items.find(i => i.id === itemId);
      if (!itemToUpdate || !firestore || !user) return;
      
      const requestRef = doc(firestore, 'procurementRequests', itemToUpdate.procurementRequestId);

      try {
          const requestSnap = await getDoc(requestRef);
          if (!requestSnap.exists()) throw new Error("Procurement request not found");
          
          const requestData = requestSnap.data() as ApprovalRequest;
          const updatedItems = requestData.items.map(i => {
              if (i.id === itemId) {
                  return { ...i, [field]: value };
              }
              return i;
          });
          
          const updatePayload = { items: updatedItems };

          await updateDoc(requestRef, updatePayload);
          
          // Also update local state for immediate UI feedback
          setItems(currentItems =>
              currentItems.map(item =>
                  item.id === itemId ? { ...item, [field]: value } : item
              )
          );

          toast({ title: "Fulfillment item updated." });

          await addDoc(collection(firestore, 'auditLogs'), {
            userId: user.uid,
            userName: user.displayName,
            action: 'fulfillment.update',
            details: `Updated field '${String(field)}' to '${value}' for item '${itemToUpdate.item}'`,
            entity: { type: 'procurementRequest', id: itemToUpdate.procurementRequestId },
            timestamp: serverTimestamp()
          });


      } catch (error: any) {
          console.error("Fulfillment Update Error:", error);
          toast({ variant: 'destructive', title: 'Update failed', description: error.message || 'Could not update the item.' });
      }
  };
  
  const handleOpenCommentDialog = (item: FulfillmentItem) => {
      setSelectedItem(item);
      setIsCommentDialogOpen(true);
  };

  const handleAddComment = async () => {
      if (!selectedItem || !newComment.trim() || !role) return;

      const newCommentText = `${role}: ${newComment}`;
      const updatedComments = [...(selectedItem.fulfillmentComments || []), newCommentText];
      
      // We call handleItemUpdate which now contains the success toast and audit log
      await handleItemUpdate(selectedItem.id, 'fulfillmentComments', updatedComments);

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
              const outstandingQty = item.qty - item.receivedQty;
              return (
                <TableRow key={item.id} className={outstandingQty > 0 && item.approvedOn > '10' ? "bg-red-500/10" : ""}>
                  <TableCell className="font-medium">{item.item}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>
                      <Input
                          type="number"
                          value={item.receivedQty}
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCommentDialog(item)}
                      className="mr-2"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Comments ({item.fulfillmentComments?.length || 0})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRecommendClick(item)}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Recommend
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isRecommendDialogOpen} onOpenChange={setIsRecommendDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>AI Fulfillment Strategy</DialogTitle>
            <DialogDescription>
              For item:{" "}
              <span className="font-semibold text-primary">{selectedItem?.item}</span>
            </DialogDescription>
          </DialogHeader>
          {isLoading && (
            <div className="flex items-center justify-center h-40">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {recommendation && (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500"/> Strategy Summary</h4>
                <p className="text-muted-foreground">{recommendation.strategySummary}</p>
              </div>
              <div>
                <h4 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-blue-500"/> Suggested Vendors</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                    {recommendation.suggestedVendors.map(vendor => (
                        <li key={vendor.name}><span className="font-semibold text-foreground">{vendor.name}:</span> {vendor.reasoning}</li>
                    ))}
                </ul>
              </div>
               <div>
                <h4 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-orange-500"/> Estimated Lead Time</h4>
                <p className="text-muted-foreground">{recommendation.estimatedLeadTimeDays} days</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
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
