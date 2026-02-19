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
import { type UserRole } from "@/firebase/auth/use-user";
import { type fulfillmentItems as allFulfillmentItems } from "@/lib/mock-data";


type FulfillmentItem = (typeof allFulfillmentItems)[0];
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
  const [items, setItems] = useState(initialItems);
  const [isRecommendDialogOpen, setIsRecommendDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendFulfillmentStrategyOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();

  const canEdit = role === 'Procurement Assistant' || role === 'Procurement Officer' || role === 'Administrator';

  const handleRecommendClick = async (item: FulfillmentItem) => {
    setSelectedItem(item);
    setIsRecommendDialogOpen(true);
    setIsLoading(true);
    setRecommendation(null);

    try {
      const result = await recommendFulfillmentStrategy(item.request as RecommendFulfillmentStrategyInput);
      setRecommendation(result);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "AI Recommendation Failed",
        description: "Could not fetch fulfillment strategy.",
      });
      setIsRecommendDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleItemUpdate = (itemId: string, field: keyof FulfillmentItem, value: any) => {
      setItems(currentItems =>
          currentItems.map(item =>
              item.id === itemId ? { ...item, [field]: value } : item
          )
      );
  };
  
  const handleOpenCommentDialog = (item: FulfillmentItem) => {
      setSelectedItem(item);
      setIsCommentDialogOpen(true);
  };

  const handleAddComment = () => {
      if (!selectedItem || !newComment.trim()) return;

      const newCommentText = `${role}: ${newComment}`;
      const updatedComments = [...(selectedItem.comments || []), newCommentText];
      
      handleItemUpdate(selectedItem.id, 'comments', updatedComments);

      toast({ title: "Comment added successfully." });
      setNewComment("");
      setIsCommentDialogOpen(false);
      setSelectedItem(null);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Total Qty</TableHead>
              <TableHead>Rcvd Qty</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const outstandingQty = item.qty - item.receivedQty;
              return (
                <TableRow key={item.id} className={outstandingQty > 0 && item.outstandingDays > 10 ? "bg-red-500/10" : ""}>
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
                      {canEdit ? (
                           <Select value={item.status} onValueChange={(value) => handleItemUpdate(item.id, 'status', value)}>
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
                          getStatusBadge(item.status)
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
                      Comments ({item.comments?.length || 0})
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
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Feedback for {selectedItem?.item}</DialogTitle>
                  <DialogDescription>View history and add new comments.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[300px] overflow-y-auto space-y-4 p-1">
                  {selectedItem?.comments && selectedItem.comments.length > 0 ? (
                      selectedItem.comments.map((comment, index) => (
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
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddComment} disabled={!canEdit}>Save Comment</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
