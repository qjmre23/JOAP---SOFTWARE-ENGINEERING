import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CreditCard,
  Clock,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Search,
  CalendarDays,
  Hash,
  Phone,
  FileText,
  X,
  ChevronDown,
} from "lucide-react";
import type { IBillingPayment, DashboardStats } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type SearchTab = "date" | "orderId" | "gcash" | "reference";

export default function BillingPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>("date");
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [gcashSearch, setGcashSearch] = useState("");
  const [referenceSearch, setReferenceSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<IBillingPayment | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<"gcash" | "reference" | null>(null);

  const gcashRef = useRef<HTMLDivElement>(null);
  const referenceRef = useRef<HTMLDivElement>(null);

  const { data: billingData, isLoading } = useQuery<{
    success: boolean;
    data: { payments: IBillingPayment[]; total: number };
  }>({
    queryKey: ["/api/billing"],
  });

  const { data: statsData } = useQuery<{
    success: boolean;
    data: DashboardStats;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const payments = billingData?.data?.payments || [];
  const stats = statsData?.data;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const hasActiveSearch = useMemo(() => {
    if (activeTab === "date" && dateMode === "single" && singleDate) return true;
    if (activeTab === "date" && dateMode === "range" && dateFrom && dateTo) return true;
    if (activeTab === "orderId" && orderIdSearch.trim()) return true;
    if (activeTab === "gcash" && gcashSearch.trim()) return true;
    if (activeTab === "reference" && referenceSearch.trim()) return true;
    return false;
  }, [activeTab, dateMode, singleDate, dateFrom, dateTo, orderIdSearch, gcashSearch, referenceSearch]);

  const filteredPayments = useMemo(() => {
    if (!hasActiveSearch) return payments;

    return payments.filter((p) => {
      if (activeTab === "date") {
        const paymentDate = new Date(p.createdAt);
        if (dateMode === "single" && singleDate) {
          const target = new Date(singleDate);
          return (
            paymentDate.getFullYear() === target.getFullYear() &&
            paymentDate.getMonth() === target.getMonth() &&
            paymentDate.getDate() === target.getDate()
          );
        }
        if (dateMode === "range" && dateFrom && dateTo) {
          const from = new Date(dateFrom);
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return paymentDate >= from && paymentDate <= to;
        }
      }
      if (activeTab === "orderId" && orderIdSearch.trim()) {
        return p.orderId.toLowerCase().includes(orderIdSearch.trim().toLowerCase());
      }
      if (activeTab === "gcash" && gcashSearch.trim()) {
        return p.gcashNumber.toLowerCase().includes(gcashSearch.trim().toLowerCase());
      }
      if (activeTab === "reference" && referenceSearch.trim()) {
        return p.gcashReferenceNumber.toLowerCase().includes(referenceSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [payments, hasActiveSearch, activeTab, dateMode, singleDate, dateFrom, dateTo, orderIdSearch, gcashSearch, referenceSearch]);

  const gcashSuggestions = useMemo(() => {
    if (!gcashSearch.trim()) return [];
    const unique = Array.from(new Set(payments.map((p) => p.gcashNumber).filter(Boolean)));
    return unique.filter((n) => n.toLowerCase().includes(gcashSearch.toLowerCase())).slice(0, 5);
  }, [payments, gcashSearch]);

  const referenceSuggestions = useMemo(() => {
    if (!referenceSearch.trim()) return [];
    const unique = Array.from(new Set(payments.map((p) => p.gcashReferenceNumber).filter(Boolean)));
    return unique.filter((n) => n.toLowerCase().includes(referenceSearch.toLowerCase())).slice(0, 5);
  }, [payments, referenceSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gcashRef.current && !gcashRef.current.contains(e.target as Node)) {
        if (showSuggestions === "gcash") setShowSuggestions(null);
      }
      if (referenceRef.current && !referenceRef.current.contains(e.target as Node)) {
        if (showSuggestions === "reference") setShowSuggestions(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const clearSearch = () => {
    setSingleDate("");
    setDateFrom("");
    setDateTo("");
    setOrderIdSearch("");
    setGcashSearch("");
    setReferenceSearch("");
  };

  const tabs: { key: SearchTab; label: string; icon: typeof CalendarDays }[] = [
    { key: "date", label: "Date", icon: CalendarDays },
    { key: "orderId", label: "Order ID", icon: Hash },
    { key: "gcash", label: "GCash #", icon: Phone },
    { key: "reference", label: "Reference #", icon: FileText },
  ];

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
        <h1 className="text-xl sm:text-2xl font-bold">Billing</h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const todayPayments = payments.filter((p) => {
    const today = new Date().toDateString();
    return new Date(p.createdAt).toDateString() === today;
  });
  const paidToday = todayPayments.reduce((sum, p) => sum + p.amountPaid, 0);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-billing-title">
          Billing & Payments
        </h1>
        <Button
          variant={searchOpen ? "default" : "outline"}
          onClick={() => setSearchOpen(!searchOpen)}
          data-testid="button-toggle-search"
        >
          <Search className="h-4 w-4 mr-2" />
          Search
          <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${searchOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {searchOpen && (
        <Card data-testid="card-search-panel">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-1 flex-wrap">
              {tabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.key)}
                  data-testid={`button-tab-${tab.key}`}
                  className="toggle-elevate"
                >
                  <tab.icon className="h-4 w-4 mr-1" />
                  {tab.label}
                </Button>
              ))}
              {hasActiveSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  data-testid="button-clear-search"
                  className="ml-auto text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {activeTab === "date" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={dateMode === "single" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateMode("single")}
                    data-testid="button-date-single"
                  >
                    Single Date
                  </Button>
                  <Button
                    variant={dateMode === "range" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateMode("range")}
                    data-testid="button-date-range"
                  >
                    Date Range
                  </Button>
                </div>
                {dateMode === "single" ? (
                  <Input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="max-w-xs"
                    data-testid="input-date-single"
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="max-w-xs"
                      data-testid="input-date-from"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="max-w-xs"
                      data-testid="input-date-to"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "orderId" && (
              <Input
                placeholder="Search by Order ID..."
                value={orderIdSearch}
                onChange={(e) => setOrderIdSearch(e.target.value)}
                className="max-w-md"
                data-testid="input-search-orderid"
              />
            )}

            {activeTab === "gcash" && (
              <div className="relative max-w-md" ref={gcashRef}>
                <Input
                  placeholder="Search by GCash number..."
                  value={gcashSearch}
                  onChange={(e) => {
                    setGcashSearch(e.target.value);
                    setShowSuggestions("gcash");
                  }}
                  onFocus={() => gcashSearch && setShowSuggestions("gcash")}
                  data-testid="input-search-gcash"
                />
                {showSuggestions === "gcash" && gcashSuggestions.length > 0 && (
                  <Card className="absolute z-50 top-full left-0 right-0 mt-1">
                    <CardContent className="p-1">
                      {gcashSuggestions.map((s) => (
                        <button
                          key={s}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover-elevate"
                          onClick={() => {
                            setGcashSearch(s);
                            setShowSuggestions(null);
                          }}
                          data-testid={`suggestion-gcash-${s}`}
                        >
                          {s}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "reference" && (
              <div className="relative max-w-md" ref={referenceRef}>
                <Input
                  placeholder="Search by Reference number..."
                  value={referenceSearch}
                  onChange={(e) => {
                    setReferenceSearch(e.target.value);
                    setShowSuggestions("reference");
                  }}
                  onFocus={() => referenceSearch && setShowSuggestions("reference")}
                  data-testid="input-search-reference"
                />
                {showSuggestions === "reference" && referenceSuggestions.length > 0 && (
                  <Card className="absolute z-50 top-full left-0 right-0 mt-1">
                    <CardContent className="p-1">
                      {referenceSuggestions.map((s) => (
                        <button
                          key={s}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover-elevate"
                          onClick={() => {
                            setReferenceSearch(s);
                            setShowSuggestions(null);
                          }}
                          data-testid={`suggestion-ref-${s}`}
                        >
                          {s}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {hasActiveSearch && (
              <p className="text-sm text-muted-foreground" data-testid="text-search-count">
                {filteredPayments.length} result{filteredPayments.length !== 1 ? "s" : ""} found
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-payments">
              {stats?.pendingPayments ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-paid-today">
              {formatCurrency(paidToday)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-revenue">
              {formatCurrency(stats?.totalRevenue ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {(stats?.pendingPayments ?? 0) > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                {stats?.pendingPayments} order(s) awaiting payment
              </span>
            </div>
            <Button variant="outline" asChild data-testid="link-pending-orders">
              <Link href="/orders">
                View Orders <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {hasActiveSearch ? "Search Results" : "Payment History"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>GCash #</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Logged By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    {hasActiveSearch
                      ? "No payments match your search"
                      : "No payment records found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow
                    key={payment._id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedPayment(payment)}
                    data-testid={`row-payment-${payment._id}`}
                  >
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.orderId}
                    </TableCell>
                    <TableCell>{payment.paymentMethod}</TableCell>
                    <TableCell>{payment.gcashNumber}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.gcashReferenceNumber}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amountPaid)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.loggedBy}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedPayment}
        onOpenChange={(open) => !open && setSelectedPayment(null)}
      >
        <DialogContent data-testid="dialog-payment-detail">
          <DialogHeader>
            <DialogTitle>Payment Detail</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(selectedPayment.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order ID</p>
                  <p className="font-mono font-medium">{selectedPayment.orderId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{selectedPayment.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(selectedPayment.amountPaid)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">GCash Number</p>
                  <p className="font-medium">{selectedPayment.gcashNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reference Number</p>
                  <p className="font-mono font-medium">
                    {selectedPayment.gcashReferenceNumber || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Date</p>
                  <p className="font-medium">
                    {selectedPayment.paymentDate
                      ? formatDate(selectedPayment.paymentDate)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Logged By</p>
                  <p className="font-medium">{selectedPayment.loggedBy}</p>
                </div>
              </div>
              {selectedPayment.proofNote && (
                <div>
                  <p className="text-sm text-muted-foreground">Proof / Note</p>
                  <p className="text-sm mt-1">{selectedPayment.proofNote}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
