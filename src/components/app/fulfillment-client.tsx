
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
import { BrainCircuit, Loader, MessageSquare } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  recommendFulfillmentStrategy,
  type RecommendFulfillmentStrategyOutput,
} from "@/ai/flows/recommend-fulfillment-strategy";


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
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<RecommendFulfillmentStrategyOutput | null>(null);

  const canEdit = role === 'Procurement Assistant' || role === 'Procurement Officer' || role === 'Administrator';

  
  const handleItemUpdate = async (itemId: string | number, field: keyof FulfillmentItem, value: any) => {
      const itemToUpdate = items.find(i => i.id === itemId);
      if (!itemToUpdate || !firestore || !user) return;
      
      const requestRef = doc(firestore, 'procurementRequests', itemToUpdate.procurementRequestId);
      const action = 'fulfillment.update';

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

          toast({ title: "Fulfillment item updated." });

          // Also update local state for immediate UI feedback
          setItems(currentItems =>
              currentItems.map(item =>
                  item.id === itemId ? { ...item, [field]: value } : item
              )
          );

          const auditLogData = {
            userId: user.uid,
            userName: user.displayName,
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
                userName: user.displayName,
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
      if (!selectedItem || !newComment.trim() || !role) return;

      const newCommentText = `${role}: ${newComment}`;
      const updatedComments = [...(selectedItem.fulfillmentComments || []), newCommentText];
      
      handleItemUpdate(selectedItem.id, 'fulfillmentComments', updatedComments);

      setNewComment("");
      setIsCommentDialogOpen(false);
      setSelectedItem(null);
  };

  const handleGetAiStrategy = async (item: FulfillmentItem) => {
    if (!item.request) {
        toast({
            variant: "destructive",
            title: "AI Strategy Failed",
            description: "Not enough item information to generate a strategy.",
        });
        return;
    }
    
    setSelectedItem(item);
    setIsAiLoading(true);
    setIsAiDialogOpen(true);
    setAiRecommendation(null);

    try {
        const recommendation = await recommendFulfillmentStrategy(item.request);
        setAiRecommendation(recommendation);
    } catch (error: any) {
        console.error("AI Strategy Error:", error);
        toast({
            variant: "destructive",
            title: "AI Strategy Failed",
            description: error.message || "Could not generate a fulfillment strategy.",
        });
        setIsAiDialogOpen(false); 
    } finally {
        setIsAiLoading(false);
    }
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
                  <TableCell className="text-right space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button size="icon" variant="outline" onClick={() => handleGetAiStrategy(item)} disabled={isAiLoading && selectedItem?.id === item.id}>
                                {isAiLoading && selectedItem?.id === item.id ? <Loader className="h-4 w-4 animate-spin"/> : <BrainCircuit className="h-4 w-4 text-primary" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Get AI Fulfillment Strategy</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5 text-primary" />
                      AI Fulfillment Strategy for "{selectedItem?.item}"
                  </DialogTitle>
                  <DialogDescription>
                      AI-powered recommendations to optimize fulfillment for this item.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-4">
                  {isAiLoading ? (
                      <div className="flex items-center justify-center h-48">
                          <Loader className="h-8 w-8 animate-spin" />
                          <p className="ml-4 text-muted-foreground">Analyzing and generating strategy...</p>
                      </div>
                  ) : aiRecommendation ? (
                      <div className="space-y-4 text-sm">
                          <div>
                              <h4 className="font-semibold mb-1">Strategy Summary</h4>
                              <p className="text-muted-foreground bg-muted p-3 rounded-md">{aiRecommendation.strategySummary}</p>
                          </div>
                          <div>
                              <h4 className="font-semibold mb-2">Suggested Vendors</h4>
                              <div className="space-y-2">
                                  {aiRecommendation.suggestedVendors.map((vendor, index) => (
                                      <div key={index} className="p-3 border rounded-md">
                                          <p className="font-semibold">{vendor.name}</p>
                                          <p className="text-muted-foreground text-xs">{vendor.reasoning}</p>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-2">
                              <div>
                                  <h4 className="font-semibold mb-1">Estimated Lead Time</h4>
                                  <p className="font-bold text-lg">{aiRecommendation.estimatedLeadTimeDays} days</p>
                              </div>
                              <div>
                                  <h4 className="font-semibold mb-1">Cost-Saving Options</h4>
                                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                      {aiRecommendation.costSavingOptions.map((option, index) => <li key={index}>{option}</li>)}
                                  </ul>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="flex items-center justify-center h-48">
                          <p className="text-muted-foreground">No recommendation available.</p>
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>Close</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
