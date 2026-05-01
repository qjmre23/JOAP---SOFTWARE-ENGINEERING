import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  HelpCircle,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Mail,
  CheckCircle,
  Clock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const feedbackSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});
type FeedbackInput = z.infer<typeof feedbackSchema>;

const messageSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(5, "Message must be at least 5 characters"),
});
type MessageInput = z.infer<typeof messageSchema>;

const faqs = [
  {
    question: "How do I create a new order?",
    answer: "Navigate to the Orders page and click the 'Create Order' button. Select a customer, add items, choose the source channel, and submit.",
  },
  {
    question: "How do I restock inventory?",
    answer: "Go to the Inventory page and click the 'Adjust' button next to the item you want to restock. Select 'Restock' as the type, enter the quantity, and submit.",
  },
  {
    question: "How do I log a payment?",
    answer: "Open the order detail page for an order with 'Pending Payment' status. Fill in the GCash number, reference number, and amount, then submit the payment form.",
  },
  {
    question: "How do I release items for an order?",
    answer: "Open the order detail page for an order with 'Pending Release' status and click the 'Release Items' button.",
  },
  {
    question: "How do I export data?",
    answer: "Go to the Reports page and use the CSV download buttons available in the Sales and Inventory tabs.",
  },
  {
    question: "How do I manage users?",
    answer: "Admin users can navigate to the Users page to create, activate/deactivate, and change roles for users.",
  },
  {
    question: "How do I adjust item prices?",
    answer: "Go to the Inventory page, find the item you want to update, and click the 'Edit Price' button. Enter the new unit price and confirm. The change is logged in the system for audit purposes.",
  },
  {
    question: "How do I view order history?",
    answer: "Navigate to the Orders page to see all orders. You can filter by status (Pending Payment, Paid, Pending Release, Completed, Cancelled) and search by tracking number or customer name. Click any order to view its full detail and status history.",
  },
  {
    question: "How do I use the billing search?",
    answer: "On the Billing page, use the search bar at the top to filter payments by GCash reference number, order tracking number, or customer name. You can also filter by date range to narrow down results.",
  },
  {
    question: "What happens when stock is critical?",
    answer: "When an item's quantity falls at or below the reorder threshold (configurable in Settings), it is flagged as 'Critical' on the Dashboard and Inventory page. A visual alert appears so you can take action and restock before running out.",
  },
  {
    question: "How do I create a backup?",
    answer: "Go to the Maintenance page (Admin only) and click 'Create Backup'. This exports all system data including items, orders, customers, payments, and logs as a JSON file that you can download and store safely.",
  },
  {
    question: "How do I view system logs?",
    answer: "Navigate to the System Logs page from the sidebar. You can see all actions performed in the system including logins, order creation, inventory adjustments, and settings changes. Filter by action type or actor to find specific entries.",
  },
  {
    question: "What are the different order statuses?",
    answer: "Orders progress through these statuses: 'Pending Payment' (awaiting payment), 'Paid' (payment received), 'Pending Release' (items ready for release), 'Completed' (items released to customer), and 'Cancelled' (order was cancelled). Each transition is logged with a timestamp and actor.",
  },
  {
    question: "How do I use the accounting module?",
    answer: "The Accounting page lets you manage chart of accounts and record general ledger entries. You can create accounts (Assets, Liabilities, Equity, Revenue, Expenses), post journal entries with debits and credits, and view the ledger for each account.",
  },
  {
    question: "How do I download reports?",
    answer: "Go to the Reports page and select the tab for the report you need (Sales, Inventory, etc.). Click the 'Download CSV' button to export the data. Reports include date ranges and can be filtered before downloading.",
  },
  {
    question: "How do I change system settings?",
    answer: "Admin users can go to the Settings page to configure thresholds like the low stock warning level, reorder threshold, company information, and other system-wide preferences. Changes take effect immediately.",
  },
  {
    question: "How do I view inventory logs?",
    answer: "On the Inventory page, click on any item to see its adjustment history. You can also view all inventory logs from the system by navigating to the Inventory Logs section, which shows restocks, deductions, and adjustments with timestamps and actors.",
  },
  {
    question: "How do I handle refunds?",
    answer: "Currently, refunds are handled by cancelling the order (if not yet completed) and creating an inventory adjustment to restock the items. The admin can update the order status and log a note explaining the refund reason in the order detail page.",
  },
  {
    question: "What is the approval flow for item deletion?",
    answer: "Item deletion requires admin approval. Only admin users can remove items from the inventory. Before deletion, the system checks if the item has any active orders. If so, the deletion is blocked until all related orders are completed or cancelled.",
  },
  {
    question: "How do I contact the admin?",
    answer: "Employees can use the 'Send Message to Admin' form on this Help page to send a message directly to the admin. Include a clear subject and detailed message. The admin will see your message in their 'Employee Messages' section.",
  },
];

export default function HelpPage() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const form = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { subject: "", message: "", email: "" },
  });

  const messageForm = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: { subject: "", message: "" },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (data: FeedbackInput) => {
      const res = await apiRequest("POST", "/api/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      form.reset();
      toast({ title: "Feedback submitted", description: "Thank you for your feedback." });
    },
    onError: (err: Error) => toast({ title: "Failed to submit feedback", description: err.message, variant: "destructive" }),
  });

  const messageMutation = useMutation({
    mutationFn: async (data: MessageInput) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return res.json();
    },
    onSuccess: () => {
      messageForm.reset();
      toast({ title: "Message sent", description: "Your message has been sent to the admin." });
    },
    onError: (err: Error) => toast({ title: "Failed to send message", description: err.message, variant: "destructive" }),
  });

  const messagesQuery = useQuery<any>({
    queryKey: ["/api/messages"],
    enabled: isAdmin,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/messages/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (err: Error) => toast({ title: "Failed to mark as read", description: err.message, variant: "destructive" }),
  });

  const messages = messagesQuery.data?.data || [];
  const isEmployee = user?.role === "EMPLOYEE";

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-help-title">Help & Support</h1>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4" /> Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {faqs.map((faq, index) => (
                <div key={index} className="border rounded-md">
                  <button
                    className="flex items-center justify-between gap-2 w-full p-3 text-left text-sm font-medium"
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    data-testid={`button-faq-${index}`}
                  >
                    {faq.question}
                    {expandedFaq === index ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {expandedFaq === index && (
                    <div className="px-3 pb-3 text-sm text-muted-foreground">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Send Feedback
              </CardTitle>
              <CardDescription>Have a question or suggestion? Let us know.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => feedbackMutation.mutate(data))} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl><Input type="email" {...field} data-testid="input-feedback-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl><Input {...field} data-testid="input-feedback-subject" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl><Textarea {...field} className="min-h-[120px]" data-testid="input-feedback-message" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={feedbackMutation.isPending} data-testid="button-submit-feedback">
                    {feedbackMutation.isPending ? <Loader2 className="animate-spin mr-1" /> : <Send className="mr-1" />}
                    Submit Feedback
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {isEmployee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Send Message to Admin
                </CardTitle>
                <CardDescription>Send a direct message to the admin team.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...messageForm}>
                  <form onSubmit={messageForm.handleSubmit((data) => messageMutation.mutate(data))} className="space-y-4">
                    <FormField control={messageForm.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl><Input {...field} data-testid="input-message-subject" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={messageForm.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl><Textarea {...field} className="min-h-[100px]" data-testid="input-message-body" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={messageMutation.isPending} data-testid="button-send-message">
                      {messageMutation.isPending ? <Loader2 className="animate-spin mr-1" /> : <Send className="mr-1" />}
                      Send Message
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Employee Messages
                </CardTitle>
                <CardDescription>Messages from employees.</CardDescription>
              </CardHeader>
              <CardContent>
                {messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg: any) => (
                      <div key={msg._id} className="border rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" data-testid={`text-msg-sender-${msg._id}`}>{msg.actor}</span>
                            <Badge variant="outline" className="text-xs">
                              {msg.metadata?.subject}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleDateString()}
                            </span>
                            {msg.metadata?.read ? (
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" /> Read
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markReadMutation.mutate(msg._id)}
                                disabled={markReadMutation.isPending}
                                data-testid={`button-mark-read-${msg._id}`}
                              >
                                <Clock className="h-3 w-3 mr-1" /> Mark Read
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-msg-body-${msg._id}`}>
                          {msg.metadata?.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
