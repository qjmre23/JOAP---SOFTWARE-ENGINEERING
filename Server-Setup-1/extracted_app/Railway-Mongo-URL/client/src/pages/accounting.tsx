import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpen,
  Plus,
  Loader2,
  Calculator,
} from "lucide-react";
import { ledgerEntrySchema, type LedgerEntryInput, type IAccountingAccount, type IGeneralLedgerEntry } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountingPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");

  const { data: accountsData, isLoading: accountsLoading } = useQuery<{ success: boolean; data: IAccountingAccount[] }>({
    queryKey: ["/api/accounting/accounts"],
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<{ success: boolean; data: { entries: IGeneralLedgerEntry[]; total: number } }>({
    queryKey: ["/api/accounting/ledger"],
  });

  const accounts = accountsData?.data || [];
  const ledgerEntries = ledgerData?.data?.entries || [];

  const filteredEntries = dateFilter
    ? ledgerEntries.filter((e) => e.date.startsWith(dateFilter))
    : ledgerEntries;

  const formatCurrency = (v: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  const totalDebits = filteredEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = filteredEntries.reduce((sum, e) => sum + e.credit, 0);

  const form = useForm<LedgerEntryInput>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], accountName: "", debit: 0, credit: 0, description: "", referenceType: "", referenceId: "" },
  });

  const addMutation = useMutation({
    mutationFn: async (data: LedgerEntryInput) => {
      const res = await apiRequest("POST", "/api/accounting/ledger", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/accounts"] });
      setAddEntryOpen(false);
      form.reset();
      toast({ title: "Entry added successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to add entry", description: err.message, variant: "destructive" }),
  });

  if (accountsLoading || ledgerLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
        <h1 className="text-xl sm:text-2xl font-bold">Accounting</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-accounting-title">Accounting</h1>
        {isAdmin && (
          <Button onClick={() => setAddEntryOpen(true)} data-testid="button-add-entry">
            <Plus className="mr-1" /> Add Entry
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold" data-testid="stat-total-debits">{formatCurrency(totalDebits)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold" data-testid="stat-total-credits">{formatCurrency(totalCredits)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold" data-testid="stat-balance">{formatCurrency(totalDebits - totalCredits)}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts" data-testid="tab-accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger">General Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chart of Accounts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No accounts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((account) => (
                      <TableRow key={account._id} data-testid={`row-account-${account._id}`}>
                        <TableCell className="font-mono">{account.accountCode}</TableCell>
                        <TableCell className="font-medium">{account.accountName}</TableCell>
                        <TableCell className="text-muted-foreground">{account.accountType}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(account.balance)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[200px]"
                data-testid="input-date-filter"
              />
              {dateFilter && (
                <Button variant="ghost" size="sm" onClick={() => setDateFilter("")} data-testid="button-clear-filter">
                  Clear
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No entries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry) => (
                        <TableRow key={entry._id} data-testid={`row-ledger-${entry._id}`}>
                          <TableCell className="text-muted-foreground">{formatDate(entry.date)}</TableCell>
                          <TableCell className="font-medium">{entry.accountName}</TableCell>
                          <TableCell className="text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</TableCell>
                          <TableCell className="text-right">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{entry.description || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{entry.referenceType ? `${entry.referenceType}:${entry.referenceId}` : "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Ledger Entry</DialogTitle>
            <DialogDescription>Create a manual journal entry.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-entry-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="accountName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-entry-account" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="debit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Debit</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} data-testid="input-entry-debit" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="credit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} data-testid="input-entry-credit" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input {...field} data-testid="input-entry-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-entry">
                {addMutation.isPending && <Loader2 className="animate-spin mr-1" />}
                Add Entry
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
