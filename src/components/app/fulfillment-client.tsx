"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wand2, Loader, CheckCircle, Truck, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { RecommendFulfillmentStrategyInput, RecommendFulfillmentStrategyOutput } from "@/ai/flows/recommend-fulfillment-strategy";
import { recommendFulfillmentStrategy } from "@/ai/flows/recommend-fulfillment-strategy";
import type { fulfillmentItems } from "@/app/(dashboard)/fulfillment/page";

type FulfillmentItem = (typeof fulfillmentItems)[0];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Sourcing":
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
          {status}
        </Badge>
      );
    case "Quoted":
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          {status}
        </Badge>
      );
    case "Ordered":
      return (
        <Badge variant="outline" className="bg-purple-100 text-purple-800">
          {status}
        </Badge>
      );
    case "Completed":
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          {status}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export function FulfillmentClient({ items }: { items: FulfillmentItem[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendFulfillmentStrategyOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRecommendClick = async (item: FulfillmentItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
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
      setIsDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox />
              </TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className={item.outstandingDays > 10 ? "bg-red-500/10" : ""}>
                <TableCell>
                  <Checkbox />
                </TableCell>
                <TableCell className="font-medium">{item.item}</TableCell>
                <TableCell>{item.department}</TableCell>
                <TableCell>{item.qty}</TableCell>
                <TableCell>{item.outstandingDays} days</TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell className="text-right">
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
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
    </>
  );
}
