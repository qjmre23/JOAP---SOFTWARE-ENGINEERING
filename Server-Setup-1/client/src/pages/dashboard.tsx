import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { useLocation } from "wouter";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Wallet,
  Package,
  TrendingUp,
  TrendingDown,
  Store,
  CalendarDays,
  ArrowUpRight,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  ArrowRightLeft,
  FileText,
  X,
  Loader2,
  MapPin,
  Globe,
  Eye,
  Sparkles,
  Volume2,
  Play,
} from "lucide-react";
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { VoiceInsightBubble } from "@/components/gemini-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLORS = {
  green: "#05cd99",
  orange: "#ff8f3c",
  purple: "#868cff",
  blue: "#4318ff",
  red: "#ee5d50",
  cyan: "#0ea5e9",
  pink: "#ec4899",
};

const GRADIENTS: Record<string, [string, string]> = {
  green: ["#05cd99", "#00b894"],
  orange: ["#ff8f3c", "#e17055"],
  purple: ["#868cff", "#6c5ce7"],
  blue: ["#4318ff", "#2d3aff"],
  cyan: ["#0ea5e9", "#0284c7"],
};

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const formatPHP = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-PH").format(value);

const formatCompact = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

interface AdvancedDashboardData {
  earnings: { total: number; trend: number; sparkline: number[] };
  orders: { total: number; trend: number; sparkline: number[] };
  customers: { total: number; trend: number; sparkline: number[] };
  balance: { total: number; inventoryValue: number };
  revenueChart: Array<{ label: string; revenue: number; orders: number }>;
  channelBreakdown: Record<string, number>;
  topItems: Array<{ itemName: string; unitPrice: number; totalQty: number; totalRevenue: number }>;
  labels: string[];
  totalRevenue: number;
  totalOrderValue: number;
}

function TrendBadge({ value }: { value: number }) {
  const isUp = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
        isUp
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400"
      }`}
      data-testid="trend-badge"
    >
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? "+" : ""}{value}%
    </span>
  );
}

function PeriodSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="text-[11px] font-semibold border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 outline-none cursor-pointer transition-colors"
      data-testid="select-period-filter"
    >
      {PERIODS.map((p) => (
        <option key={p.value} value={p.value} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100">
          {p.label}
        </option>
      ))}
    </select>
  );
}

function SparklineChart({ data, color, isCurrency = true }: { data: number[]; color: string; isCurrency?: boolean }) {
  const chartData = data.map((value, i) => ({ i, value }));
  const gradId = `spark-${color.replace("#", "")}`;
  return (
    <div className="h-[65px] w-full mt-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 6,
              border: "1px solid var(--border, #e5e7eb)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              padding: "6px 10px",
              backgroundColor: "var(--popover, #fff)",
              color: "var(--popover-foreground, #1f2937)",
            }}
            formatter={(v: number) => [isCurrency ? formatPHP(v) : formatNumber(v), ""]}
            labelFormatter={() => ""}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: "#fff", stroke: color, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  trend,
  icon: Icon,
  gradientKey,
  sparkline,
  isCurrency = true,
  period,
  onPeriodChange,
  testId,
  onClick,
  onDoubleClick,
}: {
  title: string;
  value: string;
  trend: number;
  icon: any;
  gradientKey: string;
  sparkline?: number[];
  isCurrency?: boolean;
  period: string;
  onPeriodChange: (v: string) => void;
  testId: string;
  onClick?: () => void;
  onDoubleClick?: (point: any, e: React.MouseEvent) => void;
}) {
  const gradient = GRADIENTS[gradientKey] || GRADIENTS.blue;
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div
      className={`relative bg-white dark:bg-gray-800/80 rounded-md p-5 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm transition-all duration-300 group ${
        onClick || onDoubleClick ? "cursor-pointer hover-elevate" : ""
      }`}
      onClick={(e) => {
        if (onDoubleClick) {
          if (clickTimer.current) return;
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null;
            onClick?.();
          }, 250);
        } else {
          onClick?.();
        }
      }}
      onDoubleClick={(e) => {
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
        }
        e.stopPropagation();
        onDoubleClick?.({ title, value, trend, period }, e);
      }}
      data-testid={testId}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex gap-3 items-start">
          <div
            className="w-12 h-12 rounded-md flex items-center justify-center text-white flex-shrink-0 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
              boxShadow: `0 4px 14px ${gradient[0]}40`,
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[12px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
              {title}
            </div>
            <div className="text-[24px] font-extrabold text-gray-800 dark:text-white mt-0.5 tracking-tight" data-testid={`value-${testId}`}>
              {value}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PeriodSelect value={period} onChange={onPeriodChange} />
          <TrendBadge value={trend} />
        </div>
      </div>
      {sparkline && sparkline.length > 0 && (
        <SparklineChart data={sparkline} color={gradient[0]} isCurrency={isCurrency} />
      )}
    </div>
  );
}

function RevenueSection({
  data,
  period,
  onPeriodChange,
  totalRevenue,
  totalOrderValue,
  revenueTrend,
  onChartDoubleClick,
}: {
  data: Array<{ label: string; revenue: number; orders: number }>;
  period: string;
  onPeriodChange: (v: string) => void;
  totalRevenue: number;
  totalOrderValue: number;
  revenueTrend: number;
  onChartDoubleClick?: (point: any, e: React.MouseEvent) => void;
}) {
  const lastClickedPayload = useRef<any>(null);
  const dblClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChartClick = (chartState: any, e?: React.MouseEvent) => {
    if (!onChartDoubleClick || !chartState?.activePayload?.length) return;
    const payload = chartState.activePayload[0]?.payload;
    if (!payload) return;
    lastClickedPayload.current = { ...payload, chartName: "Revenue Overview", period };
  };

  return (
    <div
      className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm"
      data-testid="section-revenue"
      onDoubleClick={(e) => {
        if (onChartDoubleClick && lastClickedPayload.current) {
          onChartDoubleClick(lastClickedPayload.current, e);
        }
      }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Revenue Overview</h3>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Track your revenue and order performance</p>
        </div>
        <PeriodSelect value={period} onChange={onPeriodChange} />
      </div>
      <div className="flex gap-8 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-md shadow-orange-200 dark:shadow-orange-900/30">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Revenue</div>
            <div className="text-xl font-extrabold text-gray-800 dark:text-white flex items-center gap-2" data-testid="value-revenue-total">
              {formatPHP(totalRevenue)}
              <TrendBadge value={revenueTrend} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-200 dark:shadow-purple-900/30">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Order Value</div>
            <div className="text-xl font-extrabold text-gray-800 dark:text-white" data-testid="value-order-total">
              {formatPHP(totalOrderValue)}
            </div>
          </div>
        </div>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} onClick={handleChartClick}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff8f3c" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#ff8f3c" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#868cff" />
                <stop offset="100%" stopColor="#6c5ce7" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
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
              formatter={(v: number, name: string) => [
                formatPHP(v),
                name === "revenue" ? "Revenue" : "Order Value",
              ]}
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
            />
            <Bar
              dataKey="revenue"
              fill="url(#barGrad)"
              radius={[6, 6, 0, 0]}
              barSize={24}
              name="revenue"
            />
            <Line
              type="monotone"
              dataKey="orders"
              stroke="url(#lineGrad)"
              strokeWidth={3}
              dot={{ r: 4, fill: "#fff", stroke: "#868cff", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#868cff", stroke: "#fff", strokeWidth: 2 }}
              name="orders"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChannelDonut({
  data,
  period,
  onPeriodChange,
}: {
  data: Record<string, number>;
  period: string;
  onPeriodChange: (v: string) => void;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const channelConfig = [
    { key: "walk-in", name: "Walk-in", color: "#ff8f3c", gradient: ["#ff8f3c", "#e17055"] },
    { key: "phone", name: "Phone", color: "#4318ff", gradient: ["#4318ff", "#2d3aff"] },
    { key: "email", name: "Email", color: "#868cff", gradient: ["#868cff", "#6c5ce7"] },
    { key: "message", name: "Message", color: "#05cd99", gradient: ["#05cd99", "#00b894"] },
  ];

  const chartData = channelConfig
    .map((ch) => ({ name: ch.name, value: data[ch.key] || 0, color: ch.color }))
    .filter((d) => d.value > 0);

  if (chartData.length === 0) {
    chartData.push({ name: "No Data", value: 1, color: "#e5e7eb" });
  }

  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm" data-testid="section-channel">
      <div className="flex justify-between items-center mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Sales by Channel</h3>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Order distribution across channels</p>
        </div>
        <PeriodSelect value={period} onChange={onPeriodChange} />
      </div>
      <div className="relative h-[220px] flex justify-center items-center my-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              strokeWidth={3}
              stroke="#fff"
              paddingAngle={2}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 6,
                border: "1px solid var(--border, #e5e7eb)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                fontSize: 12,
                padding: "8px 12px",
                backgroundColor: "var(--popover, #fff)",
                color: "var(--popover-foreground, #1f2937)",
              }}
              formatter={(v: number, name: string) => [
                `${v} orders (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute text-center flex flex-col items-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mb-1">
            <Store className="w-5 h-5 text-purple-500" />
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Total</span>
          <span className="text-2xl font-extrabold text-gray-800 dark:text-white">{total}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        {channelConfig.map((ch) => {
          const val = data[ch.key] || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div
              key={ch.key}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-gray-50 dark:bg-gray-700/30"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: ch.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{ch.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{val}</span>
                  <span className="text-[10px] text-gray-400">({pct}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopSalesList({
  items,
  period,
  onPeriodChange,
}: {
  items: Array<{ itemName: string; unitPrice: number; totalQty: number; totalRevenue: number }>;
  period: string;
  onPeriodChange: (v: string) => void;
}) {
  const maxRevenue = items.length > 0 ? Math.max(...items.map((it) => it.totalRevenue)) : 1;

  const rankColors = [
    { bg: "bg-gradient-to-r from-amber-400 to-amber-500", text: "text-white", shadow: "shadow-amber-200 dark:shadow-amber-900/30" },
    { bg: "bg-gradient-to-r from-gray-300 to-gray-400", text: "text-white", shadow: "shadow-gray-200" },
    { bg: "bg-gradient-to-r from-orange-300 to-orange-400", text: "text-white", shadow: "shadow-orange-200" },
  ];

  const itemColors = [COLORS.green, COLORS.orange, COLORS.purple, COLORS.blue, COLORS.cyan];

  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm" data-testid="section-top-sales">
      <div className="flex justify-between items-center mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Top Selling Items</h3>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Best performing products</p>
        </div>
        <PeriodSelect value={period} onChange={onPeriodChange} />
      </div>
      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-12 flex flex-col items-center gap-2">
            <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            No sales data for this period
          </div>
        ) : (
          items.map((item, i) => {
            const pct = maxRevenue > 0 ? Math.round((item.totalRevenue / maxRevenue) * 100) : 0;
            const color = itemColors[i % itemColors.length];
            const rank = rankColors[i] || null;
            return (
              <div
                key={i}
                className="group flex items-center gap-3 p-3 rounded-md hover-elevate transition-all"
                data-testid={`top-sale-item-${i}`}
              >
                {rank ? (
                  <div className={`w-8 h-8 rounded-md ${rank.bg} ${rank.text} ${rank.shadow} shadow-md flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                    #{i + 1}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                    #{i + 1}
                  </div>
                )}
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center text-white flex-shrink-0"
                  style={{
                    backgroundColor: `${color}18`,
                  }}
                >
                  <Package className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <span className="text-[13px] font-semibold text-gray-800 dark:text-white block truncate">{item.itemName}</span>
                      <span className="text-[11px] text-gray-400">{formatPHP(item.unitPrice)} / unit</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-[13px] font-bold text-gray-800 dark:text-white block">{formatPHP(item.totalRevenue)}</span>
                      <span className="text-[11px] text-gray-400">{item.totalQty} sold</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WelcomeHeader() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17) greeting = "Good evening";

  const dateStr = now.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-1">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800 dark:text-white tracking-tight" data-testid="dashboard-title">
          {greeting}!
        </h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-400 dark:text-gray-500">
          <CalendarDays className="w-4 h-4" />
          <span>{dateStr}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-100 dark:border-indigo-800/30">
        <Activity className="w-4 h-4 text-indigo-500" />
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Live Dashboard</span>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  const shimmer = "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent";
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className={`h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-md ${shimmer}`} />
          <div className={`h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded ${shimmer}`} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`bg-white dark:bg-gray-800 rounded-md p-5 h-[180px] border border-gray-100 dark:border-gray-700/50 ${shimmer}`}>
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-md" />
              <div className="space-y-2 mt-1">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className={`bg-white dark:bg-gray-800 rounded-md p-6 h-[430px] border border-gray-100 dark:border-gray-700/50 ${shimmer}`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={`bg-white dark:bg-gray-800 rounded-md p-6 h-[450px] border border-gray-100 dark:border-gray-700/50 ${shimmer}`} />
        <div className={`bg-white dark:bg-gray-800 rounded-md p-6 h-[450px] border border-gray-100 dark:border-gray-700/50 ${shimmer}`} />
      </div>
    </div>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HeatmapData {
  [date: string]: { orders: number; orderValue: number; payments: number; revenue: number };
}

interface DateDetail {
  date: string;
  hasActivity: boolean;
  summary: {
    totalSales: number;
    totalOrderValue: number;
    orderCount: number;
    paymentCount: number;
    customerCount: number;
    inventoryChanges: number;
  };
  customers: string[];
  orders: Array<{
    _id: string;
    trackingNumber: string;
    customerName: string;
    totalAmount: number;
    currentStatus: string;
    sourceChannel: string;
    itemCount: number;
    createdAt: string;
  }>;
  payments: Array<{
    _id: string;
    orderId: string;
    amountPaid: number;
    paymentMethod: string;
    gcashNumber: string;
    gcashReferenceNumber: string;
    loggedBy: string;
    paymentDate: string;
  }>;
  channelBreakdown: Record<string, number>;
  topItemsSold: Array<{ itemName: string; quantity: number; revenue: number }>;
  paymentMethods: Record<string, { count: number; total: number }>;
  orderStatuses: Record<string, number>;
  hourlyRevenue: Array<{ hour: string; revenue: number }>;
  inventoryLogs: Array<{
    _id: string;
    itemName: string;
    type: string;
    quantity: number;
    reason: string;
    actor: string;
    createdAt: string;
  }>;
  recentActivity: Array<{
    _id: string;
    action: string;
    actor: string;
    target: string;
    createdAt: string;
  }>;
}

function DateDetailPanel({ detail, onClose }: { detail: DateDetail; onClose: () => void }) {
  const d = new Date(detail.date + "T00:00:00");
  const dateStr = d.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const channelColors: Record<string, string> = { "walk-in": "#ff8f3c", phone: "#4318ff", email: "#868cff", message: "#05cd99" };
  const channelData = Object.entries(detail.channelBreakdown || {}).map(([key, val]) => ({
    name: key, value: val, color: channelColors[key] || "#9ca3af",
  })).filter(d => d.value > 0);

  const statusColors: Record<string, string> = {
    "Pending Payment": "#f59e0b", "Processing": "#3b82f6", "Completed": "#05cd99",
    "Cancelled": "#ef4444", "Shipped": "#8b5cf6", "Delivered": "#10b981",
  };
  const statusData = Object.entries(detail.orderStatuses || {}).map(([key, val]) => ({
    name: key, value: val, color: statusColors[key] || "#9ca3af",
  }));

  const hourlyData = (detail.hourlyRevenue || []).filter(h => h.revenue > 0);

  if (!detail.hasActivity) {
    return (
      <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm" data-testid="panel-date-detail">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{dateStr}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Daily Activity Summary</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-testid="button-close-detail">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <CalendarDays className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-semibold">No Activity</p>
          <p className="text-sm mt-1">Nothing happened on this day</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-md border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm overflow-hidden" data-testid="panel-date-detail">
      <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{dateStr}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Daily Activity Summary</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-testid="button-close-detail">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Sales", value: formatPHP(detail.summary.totalSales), icon: DollarSign, color: "emerald" },
            { label: "Order Value", value: formatPHP(detail.summary.totalOrderValue), icon: ShoppingBag, color: "orange" },
            { label: "Orders", value: String(detail.summary.orderCount), icon: FileText, color: "blue" },
            { label: "Payments", value: String(detail.summary.paymentCount), icon: CreditCard, color: "purple" },
            { label: "Customers", value: String(detail.summary.customerCount), icon: Users, color: "cyan" },
            { label: "Inv. Changes", value: String(detail.summary.inventoryChanges), icon: ArrowRightLeft, color: "amber" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-50 dark:bg-gray-700/30 rounded-md p-3" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className={`w-3.5 h-3.5 text-${stat.color}-500`} />
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">{stat.label}</span>
              </div>
              <div className="text-base font-bold text-gray-800 dark:text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {hourlyData.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> Hourly Revenue
            </h4>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detail.hourlyRevenue.filter((_, i) => i >= 6 && i <= 22)} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "#9ca3af", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} width={40} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.12)", fontSize: 11, padding: "6px 10px",
                      backgroundColor: "var(--popover, #fff)", color: "var(--popover-foreground, #1f2937)",
                    }}
                    formatter={(v: number) => [formatPHP(v), "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#4318ff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {channelData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Store className="w-4 h-4 text-purple-500" /> Sales Channels
              </h4>
              <div className="flex items-center gap-4">
                <div className="h-[120px] w-[120px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} strokeWidth={2} stroke="#fff" paddingAngle={2}>
                        {channelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {channelData.map((ch) => (
                    <div key={ch.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
                      <span className="text-gray-500 dark:text-gray-400 capitalize">{ch.name}</span>
                      <span className="ml-auto font-bold text-gray-800 dark:text-white">{ch.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {statusData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" /> Order Status
              </h4>
              <div className="space-y-2">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">{s.name}</span>
                    <span className="text-xs font-bold text-gray-800 dark:text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {detail.topItemsSold.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" /> Items Sold
            </h4>
            <div className="space-y-2">
              {detail.topItemsSold.map((item, i) => {
                const maxRev = detail.topItemsSold[0]?.revenue || 1;
                const pct = Math.round((item.revenue / maxRev) * 100);
                return (
                  <div key={i} className="flex items-center gap-3 group" data-testid={`date-item-${i}`}>
                    <span className="text-[11px] font-bold text-gray-400 w-5 text-right">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{item.itemName}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-white ml-2 flex-shrink-0">{formatPHP(item.revenue)}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5">{item.quantity} units</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {detail.orders.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" /> Orders ({detail.orders.length})
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {detail.orders.map((order) => (
                <div key={order._id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-md text-xs" data-testid={`date-order-${order._id}`}>
                  <div>
                    <span className="font-semibold text-gray-800 dark:text-white">{order.trackingNumber}</span>
                    <span className="text-gray-400 mx-1.5">|</span>
                    <span className="text-gray-500 dark:text-gray-400">{order.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                      backgroundColor: `${statusColors[order.currentStatus] || "#9ca3af"}20`,
                      color: statusColors[order.currentStatus] || "#9ca3af",
                    }}>{order.currentStatus}</span>
                    <span className="font-bold text-gray-800 dark:text-white">{formatPHP(order.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail.payments.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-500" /> Payments ({detail.payments.length})
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {detail.payments.map((payment) => (
                <div key={payment._id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-md text-xs" data-testid={`date-payment-${payment._id}`}>
                  <div>
                    <span className="font-semibold text-gray-800 dark:text-white">{payment.paymentMethod}</span>
                    {payment.gcashReferenceNumber && (
                      <span className="text-gray-400 ml-1.5">Ref: {payment.gcashReferenceNumber}</span>
                    )}
                    <span className="text-gray-400 ml-1.5">by {payment.loggedBy}</span>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPHP(payment.amountPaid)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail.inventoryLogs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-500" /> Inventory Changes ({detail.inventoryLogs.length})
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {detail.inventoryLogs.map((log) => (
                <div key={log._id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-md text-xs" data-testid={`date-inv-${log._id}`}>
                  <div>
                    <span className="font-semibold text-gray-800 dark:text-white">{log.itemName}</span>
                    <span className="text-gray-400 mx-1.5">|</span>
                    <span className={`font-medium ${log.type === "restock" ? "text-emerald-500" : log.type === "deduction" ? "text-red-500" : "text-blue-500"}`}>
                      {log.type === "restock" ? "+" : log.type === "deduction" ? "-" : "~"}{log.quantity}
                    </span>
                  </div>
                  <span className="text-gray-400">{log.reason || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail.customers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" /> Customers ({detail.customers.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {detail.customers.map((c, i) => (
                <span key={i} className="px-2.5 py-1 bg-gray-50 dark:bg-gray-700/30 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">{c}</span>
              ))}
            </div>
          </div>
        )}

        {detail.recentActivity.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Activity Log
            </h4>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {detail.recentActivity.map((log) => (
                <div key={log._id} className="flex items-center gap-2 text-[11px] py-1.5 px-2 bg-gray-50 dark:bg-gray-700/20 rounded">
                  <span className="text-gray-400 flex-shrink-0">{new Date(log.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium text-indigo-500 flex-shrink-0">{log.actor}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate">{log.action.replace(/_/g, " ").toLowerCase()}{log.target ? ` → ${log.target}` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarSection() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: heatmapData, isLoading: heatmapLoading, isError: heatmapError } = useQuery<{ success: boolean; data: { heatmap: HeatmapData } }>({
    queryKey: ["/api/dashboard/calendar-heatmap", currentYear, currentMonth],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dashboard/calendar-heatmap?year=${currentYear}&month=${currentMonth}`);
      return res.json();
    },
  });

  const tzOffset = new Date().getTimezoneOffset() * -1;

  const { data: dateDetailData, isLoading: detailLoading } = useQuery<{ success: boolean; data: DateDetail }>({
    queryKey: ["/api/dashboard/date-detail", selectedDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dashboard/date-detail?date=${selectedDate}&tz=${tzOffset}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  const heatmap = heatmapData?.data?.heatmap || {};
  const detail = dateDetailData?.data;

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    setSelectedDate(null);
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();

    const days: Array<{ day: number; dateStr: string; isCurrentMonth: boolean; isToday: boolean }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = currentMonth === 1 ? 12 : currentMonth - 1;
      const y = currentMonth === 1 ? currentYear - 1 : currentYear;
      days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isCurrentMonth: false, isToday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = d === today.getDate() && currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();
      days.push({ day: d, dateStr, isCurrentMonth: true, isToday });
    }

    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 12 ? 1 : currentMonth + 1;
      const y = currentMonth === 12 ? currentYear + 1 : currentYear;
      days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isCurrentMonth: false, isToday: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  const getHeatLevel = (dateStr: string): number => {
    const data = heatmap[dateStr];
    if (!data) return 0;
    const total = data.orders + data.payments;
    if (total >= 10) return 4;
    if (total >= 5) return 3;
    if (total >= 2) return 2;
    return 1;
  };

  const heatColors = [
    "",
    "bg-emerald-100 dark:bg-emerald-900/30",
    "bg-emerald-200 dark:bg-emerald-800/40",
    "bg-emerald-300 dark:bg-emerald-700/50",
    "bg-emerald-400 dark:bg-emerald-600/60",
  ];

  return (
    <div className="space-y-5" data-testid="section-calendar">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-5 h-5 text-indigo-500" />
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Activity Calendar</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
        <div className="bg-white dark:bg-gray-800/80 rounded-md p-5 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm" data-testid="calendar-widget">
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-testid="button-prev-month">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="text-center">
              <h4 className="text-sm font-bold text-gray-800 dark:text-white" data-testid="text-current-month">
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </h4>
              <button onClick={goToToday} className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium mt-0.5" data-testid="button-go-today">
                Today
              </button>
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-testid="button-next-month">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {heatmapLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
          )}
          {heatmapError && (
            <div className="text-center text-xs text-red-500 py-4">Failed to load calendar data</div>
          )}

          <div className="grid grid-cols-7 gap-1" style={{ opacity: heatmapLoading ? 0.4 : 1 }}>
            {calendarDays.map((day, i) => {
              const heat = day.isCurrentMonth ? getHeatLevel(day.dateStr) : 0;
              const isSelected = selectedDate === day.dateStr;
              const hasData = heat > 0;
              const dayData = heatmap[day.dateStr];

              return (
                <button
                  key={i}
                  onClick={() => day.isCurrentMonth && setSelectedDate(day.dateStr)}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center rounded-md text-xs transition-all
                    ${!day.isCurrentMonth ? "text-gray-300 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"}
                    ${day.isCurrentMonth && !isSelected ? "hover:bg-gray-100 dark:hover:bg-gray-700" : ""}
                    ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold" : ""}
                    ${day.isToday && !isSelected ? "font-bold text-indigo-600 dark:text-indigo-400" : ""}
                    ${heat > 0 && !isSelected ? heatColors[heat] : ""}
                  `}
                  data-testid={`calendar-day-${day.dateStr}`}
                >
                  <span className="leading-none">{day.day}</span>
                  {day.isToday && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-500" />
                  )}
                  {hasData && !isSelected && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
            <span className="text-[10px] text-gray-400">Activity:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" />
              <span className="text-[9px] text-gray-400">None</span>
            </div>
            {[1, 2, 3, 4].map((level) => (
              <div key={level} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-sm ${heatColors[level]}`} />
              </div>
            ))}
            <span className="text-[9px] text-gray-400">High</span>
          </div>
        </div>

        <div className="min-h-[300px]">
          {detailLoading && selectedDate ? (
            <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : detail && selectedDate ? (
            <DateDetailPanel detail={detail} onClose={() => setSelectedDate(null)} />
          ) : (
            <div className="bg-white dark:bg-gray-800/80 rounded-md p-6 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <CalendarDays className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">Select a date to view details</p>
              <p className="text-xs mt-1">Click on any day in the calendar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [voiceInsight, setVoiceInsight] = useState<{ position: { x: number; y: number }; clickedPoint: any; id: number } | null>(null);
  const voiceInsightCounter = useRef(0);
  const [earningsPeriod, setEarningsPeriod] = useState("monthly");
  const [ordersPeriod, setOrdersPeriod] = useState("monthly");
  const [customersPeriod, setCustomersPeriod] = useState("yearly");
  const [balancePeriod, setBalancePeriod] = useState("yearly");
  const [revenuePeriod, setRevenuePeriod] = useState("yearly");
  const [channelPeriod, setChannelPeriod] = useState("monthly");
  const [topSalesPeriod, setTopSalesPeriod] = useState("monthly");

  useEffect(() => {
    const socket = io();

    socket.on("ORDER_CREATED", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    });

    socket.on("ORDER_PAID", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
    });

    socket.on("ORDER_RELEASED", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    });

    socket.on("INVENTORY_LOG_CREATED", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    });

    socket.on("LEDGER_POSTED", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/ledger"] });
    });

    socket.on("PAYMENT_LOGGED", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const fetchDashboard = async (period: string) => {
    const res = await fetch(`/api/dashboard/advanced?period=${period}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    return res.json();
  };

  const { data: earningsData, isLoading: earningsLoading } = useQuery<{ success: boolean; data: AdvancedDashboardData }>({
    queryKey: ["/api/dashboard/advanced", earningsPeriod],
    queryFn: () => fetchDashboard(earningsPeriod),
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ success: boolean; data: AdvancedDashboardData }>({
    queryKey: ["/api/dashboard/advanced", ordersPeriod],
    queryFn: () => fetchDashboard(ordersPeriod),
  });

  const { data: customersData } = useQuery<{ success: boolean; data: AdvancedDashboardData }>({
    queryKey: ["/api/dashboard/advanced", customersPeriod],
    queryFn: () => fetchDashboard(customersPeriod),
  });

  const { data: balanceData } = useQuery<{ success: boolean; data: AdvancedDashboardData }>({
    queryKey: ["/api/dashboard/advanced", balancePeriod],
    queryFn: () => fetchDashboard(balancePeriod),
  });

  const { data: revenueData } = useQuery<{ success: boolean; data: AdvancedDashboardData }>({
    queryKey: ["/api/dashboard/advanced", revenuePeriod],
    queryFn: () => fetchDashboard(revenuePeriod),
  });

  const { data: channelData } = useQuery<{ success: boolean; data: AdvancedDashboardData }>({
    queryKey: ["/api/dashboard/advanced", channelPeriod],
    queryFn: () => fetchDashboard(channelPeriod),
  });

  const { data: topSalesData } = useQuery<{ success: boolean; data: AdvancedDashboardData }>({
    queryKey: ["/api/dashboard/advanced", topSalesPeriod],
    queryFn: () => fetchDashboard(topSalesPeriod),
  });

  const { data: forecastWidgetData } = useQuery<{ success: boolean; data: { nextWeekForecast: number; trend: number; forecastPoints: Array<{ date: string; value: number }>; model: string } }>({
    queryKey: ["/api/dashboard/forecast"],
  });

  const earnings = earningsData?.data;
  const orders = ordersData?.data;
  const customers = customersData?.data;
  const balance = balanceData?.data;
  const revenue = revenueData?.data;
  const channel = channelData?.data;
  const topSales = topSalesData?.data;

  const handleChartDoubleClick = (point: any, e: React.MouseEvent) => {
    voiceInsightCounter.current += 1;
    setVoiceInsight({
      position: { x: e.clientX, y: e.clientY },
      clickedPoint: point,
      id: voiceInsightCounter.current,
    });
  };

  if (earningsLoading || ordersLoading) {
    return (
      <div className="p-3 sm:p-5 max-w-[1280px] mx-auto">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-[1280px] mx-auto space-y-4 sm:space-y-6 overflow-auto h-full" data-testid="dashboard-container">
      <WelcomeHeader />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <SummaryCard
          title="Total Earnings"
          value={formatPHP(earnings?.earnings?.total ?? 0)}
          trend={earnings?.earnings?.trend ?? 0}
          icon={DollarSign}
          gradientKey="green"
          sparkline={earnings?.earnings?.sparkline}
          period={earningsPeriod}
          onPeriodChange={setEarningsPeriod}
          testId="card-earnings"
          onClick={() => navigate("/billing")}
          onDoubleClick={handleChartDoubleClick}
        />
        <SummaryCard
          title="Total Orders"
          value={formatNumber(orders?.orders?.total ?? 0)}
          trend={orders?.orders?.trend ?? 0}
          icon={ShoppingBag}
          gradientKey="orange"
          sparkline={orders?.orders?.sparkline}
          isCurrency={false}
          period={ordersPeriod}
          onPeriodChange={setOrdersPeriod}
          testId="card-orders"
          onClick={() => navigate("/orders")}
          onDoubleClick={handleChartDoubleClick}
        />
        <SummaryCard
          title="Customers"
          value={formatNumber(customers?.customers?.total ?? 0)}
          trend={customers?.customers?.trend ?? 0}
          icon={Users}
          gradientKey="purple"
          sparkline={customers?.customers?.sparkline}
          isCurrency={false}
          period={customersPeriod}
          onPeriodChange={setCustomersPeriod}
          testId="card-customers"
          onDoubleClick={handleChartDoubleClick}
        />
        <SummaryCard
          title="Pending Balance"
          value={formatPHP(balance?.balance?.total ?? 0)}
          trend={0}
          icon={Wallet}
          gradientKey="blue"
          period={balancePeriod}
          onPeriodChange={setBalancePeriod}
          testId="card-balance"
          onClick={() => navigate("/billing")}
          onDoubleClick={handleChartDoubleClick}
        />
      </div>

      <RevenueSection
        data={revenue?.revenueChart ?? []}
        period={revenuePeriod}
        onPeriodChange={setRevenuePeriod}
        totalRevenue={revenue?.totalRevenue ?? 0}
        totalOrderValue={revenue?.totalOrderValue ?? 0}
        revenueTrend={revenue?.earnings?.trend ?? 0}
        onChartDoubleClick={handleChartDoubleClick}
      />

      {forecastWidgetData?.data && (
        <div className="bg-white dark:bg-gray-800/80 rounded-md p-5 border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm" data-testid="section-forecast">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-md shadow-purple-200 dark:shadow-purple-900/30">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800 dark:text-white">7-Day Revenue Forecast</h4>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{forecastWidgetData.data.model}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold text-gray-800 dark:text-white" data-testid="value-forecast-total">
                {formatPHP(forecastWidgetData.data.nextWeekForecast)}
              </div>
              <TrendBadge value={forecastWidgetData.data.trend} />
            </div>
          </div>
          <div className="flex gap-1.5">
            {forecastWidgetData.data.forecastPoints.map((pt, i) => {
              const max = Math.max(...forecastWidgetData.data.forecastPoints.map(p => p.value), 1);
              const pct = Math.max(8, (pt.value / max) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden h-16 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-full transition-all"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 dark:text-gray-500">{pt.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChannelDonut
          data={channel?.channelBreakdown ?? {}}
          period={channelPeriod}
          onPeriodChange={setChannelPeriod}
        />
        <TopSalesList
          items={topSales?.topItems ?? []}
          period={topSalesPeriod}
          onPeriodChange={setTopSalesPeriod}
        />
      </div>

      <CalendarSection />

      {voiceInsight && (
        <VoiceInsightBubble
          key={voiceInsight.id}
          position={voiceInsight.position}
          clickedPoint={voiceInsight.clickedPoint}
          onClose={() => setVoiceInsight(null)}
        />
      )}
    </div>
  );
}
