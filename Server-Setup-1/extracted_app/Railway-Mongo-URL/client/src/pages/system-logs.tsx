import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search, X } from "lucide-react";
import type { ISystemLog } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function formatReadableDescription(log: ISystemLog): string {
  const { action, actor, target, metadata } = log;
  const meta = metadata || {};

  switch (action) {
    case "INVENTORY_LOG_CREATED": {
      const type = meta.type || "adjust";
      const qty = meta.quantity ?? 0;
      return `${actor} ${type}ed ${Math.abs(qty)} from ${target}`;
    }
    case "USER_LOGIN":
      return `${actor} logged in`;
    case "USER_LOGOUT":
      return `${actor} logged out`;
    case "ORDER_CREATED": {
      const total = meta.totalAmount;
      const totalStr = total != null
        ? ` (total: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(total)})`
        : "";
      return `${actor} created order ${target}${totalStr}`;
    }
    case "PAYMENT_LOGGED": {
      const amount = meta.amount ?? meta.amountPaid;
      const amountStr = amount != null
        ? ` (amount: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)})`
        : "";
      return `${actor} logged payment for order ${target}${amountStr}`;
    }
    case "ITEM_CREATED":
      return `${actor} added new item ${target}`;
    case "USER_CREATED": {
      const role = meta.role || "";
      return `${actor} created user ${target}${role ? ` (role: ${role})` : ""}`;
    }
    case "SETTINGS_CHANGED":
      return `${actor} updated system settings`;
    case "ITEM_PRICE_ADJUSTED": {
      const price = meta.unitPrice;
      const priceStr = price != null
        ? ` to ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(price)}`
        : "";
      return `${actor} adjusted price of ${target}${priceStr}`;
    }
    default:
      return `${actor} performed ${action}${target ? ` on ${target}` : ""}`;
  }
}

function getActionColor(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return "secondary";
  if (action.includes("CREATED")) return "default";
  if (action.includes("PAYMENT")) return "default";
  if (action.includes("ADJUSTED") || action.includes("CHANGED")) return "outline";
  if (action.includes("INVENTORY")) return "secondary";
  return "outline";
}

function formatMetadataKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SystemLogsPage() {
  const { isAdmin } = useAuth();
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ISystemLog | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: logsData, isLoading } = useQuery<{
    success: boolean;
    data: { logs: ISystemLog[]; total: number };
  }>({
    queryKey: ["/api/system-logs"],
  });

  const logs = logsData?.data?.logs || [];
  const actions = Array.from(new Set(logs.map((l) => l.action)));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    let result = actionFilter === "all" ? logs : logs.filter((l) => l.action === actionFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.actor.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          (l.target && l.target.toLowerCase().includes(q))
      );
    }
    return result;
  }, [logs, actionFilter, searchQuery]);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const actorMatches = Array.from(new Set(logs.map((l) => l.actor)))
      .filter((a) => a.toLowerCase().includes(q))
      .map((a) => ({ type: "Actor", value: a }));
    const targetMatches = Array.from(new Set(logs.map((l) => l.target).filter(Boolean)))
      .filter((t) => t.toLowerCase().includes(q))
      .map((t) => ({ type: "Target", value: t }));
    const actionMatches = actions
      .filter((a) => a.toLowerCase().includes(q))
      .map((a) => ({ type: "Action", value: a }));
    return [...actorMatches, ...targetMatches, ...actionMatches].slice(0, 8);
  }, [logs, actions, searchQuery]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  if (!isAdmin) {
    return (
      <div className="p-3 sm:p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
        <h1 className="text-2xl font-bold">System Logs</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-logs-title">
        System Logs
      </h1>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by actor, action, or target..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
              setPage(1);
            }}
            onFocus={() => searchQuery && setShowSuggestions(true)}
            className="pl-9"
            data-testid="input-search-logs"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => {
                setSearchQuery("");
                setShowSuggestions(false);
                setPage(1);
              }}
              data-testid="button-clear-log-search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <Card className="absolute z-50 top-full left-0 right-0 mt-1">
              <CardContent className="p-1">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.type}-${s.value}-${i}`}
                    className="w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 hover-elevate"
                    onClick={() => {
                      setSearchQuery(s.value);
                      setShowSuggestions(false);
                      setPage(1);
                    }}
                    data-testid={`suggestion-log-${i}`}
                  >
                    <Badge variant="secondary" className="text-xs">
                      {s.type}
                    </Badge>
                    <span>{s.value}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]" data-testid="select-action-filter">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground" data-testid="text-log-count">
          {filtered.length} entries
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground py-8"
                  >
                    No logs found
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((log) => (
                  <TableRow
                    key={log._id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedLog(log)}
                    data-testid={`row-log-${log._id}`}
                  >
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(log.action)} className="text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatReadableDescription(log)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}

      <Dialog
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent data-testid="dialog-log-detail">
          <DialogHeader>
            <DialogTitle>Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Action</p>
                  <Badge variant={getActionColor(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Actor</p>
                  <p className="font-medium">{selectedLog.actor}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-medium">{selectedLog.target || "-"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm font-medium">
                  {formatReadableDescription(selectedLog)}
                </p>
              </div>

              {selectedLog.metadata &&
                Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Metadata</p>
                    <div className="rounded-md border">
                      {Object.entries(selectedLog.metadata).map(
                        ([key, value], idx) => (
                          <div
                            key={key}
                            className={`flex items-start gap-4 px-3 py-2 text-sm ${
                              idx > 0 ? "border-t" : ""
                            }`}
                            data-testid={`metadata-${key}`}
                          >
                            <span className="text-muted-foreground min-w-[120px]">
                              {formatMetadataKey(key)}
                            </span>
                            <span className="font-medium break-all">
                              {formatMetadataValue(value)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
