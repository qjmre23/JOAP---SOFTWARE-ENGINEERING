import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart3,
  Download,
  FileText,
  Calendar,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Package,
  AlertTriangle,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { IOrder, IItem } from "@shared/schema";

function downloadCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadSalesPDF(
  orders: IOrder[],
  summary: { totalOrders: number; totalRevenue: number; avgOrderValue: number },
  startDate: string,
  endDate: string
) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("JOAP Hardware Trading - Sales Report", 14, 20);

  doc.setFontSize(10);
  const dateRange = startDate || endDate
    ? `Date Range: ${startDate || "All"} to ${endDate || "All"}`
    : "Date Range: All";
  doc.text(dateRange, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

  doc.setFontSize(12);
  doc.text("Summary", 14, 48);
  doc.setFontSize(10);
  doc.text(`Total Orders: ${summary.totalOrders}`, 14, 56);
  doc.text(
    `Total Revenue: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(summary.totalRevenue)}`,
    14,
    62
  );
  doc.text(
    `Avg Order Value: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(summary.avgOrderValue)}`,
    14,
    68
  );

  autoTable(doc, {
    startY: 76,
    head: [["Date", "Order ID", "Amount", "Method", "Reference"]],
    body: orders.map((o) => [
      new Date(o.createdAt).toLocaleDateString(),
      o.trackingNumber,
      new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(o.totalAmount),
      o.sourceChannel,
      o.trackingNumber,
    ]),
  });

  doc.save("sales-report.pdf");
}

function downloadInventoryPDF(items: IItem[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("JOAP Hardware Trading - Inventory Report", 14, 20);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  autoTable(doc, {
    startY: 38,
    head: [["Name", "Category", "Price", "Quantity", "Value"]],
    body: items.map((i) => [
      i.itemName,
      i.category,
      new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(i.unitPrice),
      i.currentQuantity.toString(),
      new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(i.unitPrice * i.currentQuantity),
    ]),
  });

  doc.save("inventory-report.pdf");
}

const formatPHP = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

const formatCompact = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ success: boolean; data: { orders: IOrder[]; total: number; page: number; pageSize: number } }>({
    queryKey: ["/api/orders"],
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ success: boolean; data: { items: IItem[]; total: number; page: number; pageSize: number } }>({
    queryKey: ["/api/items"],
  });

  const { data: revenueData } = useQuery<{ success: boolean; data: Array<{ date: string; revenue: number }> }>({
    queryKey: ["/api/dashboard/revenue-chart"],
  });

  const { data: forecastData } = useQuery<{ success: boolean; data: { forecast: Array<{ date: string; actual?: number; forecast?: number }>; model: { type: string; arCoefficients: number[]; maWindow: number; trend: number; intercept: number } } }>({
    queryKey: ["/api/reports/forecast"],
  });

  const orders = ordersData?.data?.orders || [];
  const items = itemsData?.data?.items || [];
  const revenueChart = revenueData?.data || [];
  const forecastChart = forecastData?.data?.forecast || [];
  const forecastModel = forecastData?.data?.model;

  const filteredOrders = orders.filter((o) => {
    if (startDate && new Date(o.createdAt) < new Date(startDate)) return false;
    if (endDate && new Date(o.createdAt) > new Date(endDate + "T23:59:59")) return false;
    return true;
  });

  const salesSummary = filteredOrders.reduce(
    (acc, o) => ({
      totalOrders: acc.totalOrders + 1,
      totalRevenue: acc.totalRevenue + o.totalAmount,
      avgOrderValue: 0,
    }),
    { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 }
  );
  salesSummary.avgOrderValue = salesSummary.totalOrders > 0 ? salesSummary.totalRevenue / salesSummary.totalOrders : 0;

  const lowStockItems = items.filter((i) => i.currentQuantity <= i.reorderLevel);

  if (ordersLoading || itemsLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
        <h1 className="text-xl sm:text-2xl font-bold">Reports</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-reports-title">Reports</h1>

      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-[180px]"
          data-testid="input-start-date"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-[180px]"
          data-testid="input-end-date"
        />
        {(startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); }} data-testid="button-clear-dates">
            Clear
          </Button>
        )}
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales" data-testid="tab-sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory</TabsTrigger>
          <TabsTrigger value="forecast" data-testid="tab-forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="bg-white dark:bg-gray-800/80 rounded-md p-5 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Total Orders</div>
                  <div className="text-xl font-extrabold text-gray-800 dark:text-white" data-testid="stat-report-orders">{salesSummary.totalOrders}</div>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800/80 rounded-md p-5 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200 dark:shadow-emerald-900/30">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Total Revenue</div>
                  <div className="text-xl font-extrabold text-gray-800 dark:text-white" data-testid="stat-report-revenue">{formatPHP(salesSummary.totalRevenue)}</div>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800/80 rounded-md p-5 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-200 dark:shadow-purple-900/30">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Avg Order Value</div>
                  <div className="text-xl font-extrabold text-gray-800 dark:text-white" data-testid="stat-report-avg">{formatPHP(salesSummary.avgOrderValue)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Revenue Trend</h3>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Revenue performance over time</p>
              </div>
            </div>
            {revenueChart.length > 0 ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueChart} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="reportBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff8f3c" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#ff8f3c" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="reportLineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#868cff" />
                        <stop offset="100%" stopColor="#6c5ce7" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      dy={8}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCompact(v)}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 6,
                        border: "1px solid var(--border, #e5e7eb)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                        fontSize: 12,
                        padding: "10px 14px",
                        backgroundColor: "var(--popover, #fff)",
                        color: "var(--popover-foreground, #1f2937)",
                      }}
                      formatter={(v: number) => [formatPHP(v), "Revenue"]}
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="url(#reportBarGrad)"
                      radius={[6, 6, 0, 0]}
                      barSize={24}
                      name="revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="url(#reportLineGrad)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#fff", stroke: "#868cff", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#868cff", stroke: "#fff", strokeWidth: 2 }}
                      name="trend"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-gray-400 dark:text-gray-500 text-sm">No data available</div>
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Sales Data</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  filteredOrders.map((o) => ({ trackingNumber: o.trackingNumber, customer: o.customerName, total: o.totalAmount, status: o.currentStatus, date: o.createdAt })),
                  "sales-report.csv"
                )} data-testid="button-download-sales">
                  <Download className="mr-1 h-3 w-3" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadSalesPDF(filteredOrders, salesSummary, startDate, endDate)} data-testid="button-download-sales-pdf">
                  <FileText className="mr-1 h-3 w-3" /> Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                  ) : (
                    filteredOrders.slice(0, 50).map((o) => (
                      <TableRow key={o._id}>
                        <TableCell className="font-mono text-sm">{o.trackingNumber}</TableCell>
                        <TableCell>{o.customerName}</TableCell>
                        <TableCell className="text-right">{formatPHP(o.totalAmount)}</TableCell>
                        <TableCell>{o.currentStatus}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Low Stock / Critical Items
                </CardTitle>
                <CardDescription>{lowStockItems.length} items need attention</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  lowStockItems.map((i) => ({ name: i.itemName, category: i.category, quantity: i.currentQuantity, reorderLevel: i.reorderLevel, price: i.unitPrice })),
                  "inventory-report.csv"
                )} data-testid="button-download-inventory">
                  <Download className="mr-1 h-3 w-3" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadInventoryPDF(items)} data-testid="button-download-inventory-pdf">
                  <FileText className="mr-1 h-3 w-3" /> Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">All items stocked</TableCell></TableRow>
                  ) : (
                    lowStockItems.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="text-right">{item.currentQuantity}</TableCell>
                        <TableCell className="text-right">{item.reorderLevel}</TableCell>
                        <TableCell className="text-right">{formatPHP(item.unitPrice)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {items.length > 0 && (
            <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Stock Levels by Category</h3>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(
                      items.reduce((acc, item) => {
                        acc[item.category] = (acc[item.category] || 0) + item.currentQuantity;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10)}
                    margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="stockBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#05cd99" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#05cd99" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#9ca3af", fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      dy={8}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCompact(v)}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 6,
                        border: "1px solid var(--border, #e5e7eb)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                        fontSize: 12,
                        padding: "10px 14px",
                        backgroundColor: "var(--popover, #fff)",
                        color: "var(--popover-foreground, #1f2937)",
                      }}
                      formatter={(v: number) => [v.toLocaleString(), "Units"]}
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    />
                    <Bar
                      dataKey="qty"
                      fill="url(#stockBarGrad)"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="forecast" className="space-y-6">
          <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">ARIMA Revenue Forecast</h3>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">30-day forecast using AR + Trend + Moving Average model</p>
              </div>
              {forecastModel && (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" data-testid="badge-forecast-model">
                    {forecastModel.type}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    Trend: {forecastModel.trend > 0 ? "+" : ""}{forecastModel.trend.toFixed(2)}/day
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    MA Window: {forecastModel.maWindow}
                  </span>
                </div>
              )}
            </div>
            {forecastChart.length > 0 ? (
              <div className="h-[360px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastChart} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="forecastActualGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#4f8cff" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="forecastPredGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9ca3af", fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      dy={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCompact(v)}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 6,
                        border: "1px solid var(--border, #e5e7eb)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                        fontSize: 12,
                        padding: "10px 14px",
                        backgroundColor: "var(--popover, #fff)",
                        color: "var(--popover-foreground, #1f2937)",
                      }}
                      formatter={(v: number, name: string) => [formatPHP(v), name === "actual" ? "Historical" : "Forecast"]}
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#4f8cff"
                      strokeWidth={2.5}
                      fill="url(#forecastActualGrad)"
                      dot={{ r: 3, fill: "#fff", stroke: "#4f8cff", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#4f8cff", stroke: "#fff", strokeWidth: 2 }}
                      connectNulls={false}
                      name="actual"
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#a855f7"
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: "#fff", stroke: "#a855f7", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#a855f7", stroke: "#fff", strokeWidth: 2 }}
                      connectNulls={false}
                      name="forecast"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[360px] text-gray-400 dark:text-gray-500 text-sm">
                Insufficient data for ARIMA forecast
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
