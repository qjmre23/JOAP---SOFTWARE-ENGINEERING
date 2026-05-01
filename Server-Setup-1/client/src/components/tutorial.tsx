import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { X, SkipForward, Volume2, VolumeX, ChevronRight } from "lucide-react";

interface CursorAction {
  triggerTime: number;
  type: "move" | "click" | "doubleClick" | "type" | "hover" | "highlight" | "scroll" | "navigate" | "focusDialog" | "pressEnter" | "clickFirst";
  target?: string;
  value?: string;
  duration?: number;
  highlightType?: "full" | "small-circle";
  revert?: boolean;
}

interface TutorialStep {
  path: string;
  target: string;
  title: string;
  narration: string;
  mp3File: string;
  actions: CursorAction[];
}

const ADMIN_STEPS: TutorialStep[] = [
  {
    path: "/",
    target: "[data-testid='button-sidebar-toggle']",
    title: "Welcome to JOAP Hardware Trading",
    narration: "Welcome to JOAP Hardware Trading management system! I'll guide you through all the features. This is the sidebar toggle. You can click it to expand or collapse the navigation menu on the left side.",
    mp3File: "tut1.mp3",
    actions: [
      { triggerTime: 0.5, type: "highlight", target: "[data-testid='button-sidebar-toggle']", highlightType: "small-circle" },
      { triggerTime: 3, type: "move", target: "[data-testid='button-sidebar-toggle']" },
      { triggerTime: 4, type: "click", target: "[data-testid='button-sidebar-toggle']" },
      { triggerTime: 6, type: "move", target: "[data-testid='nav-dashboard']" },
      { triggerTime: 7.5, type: "click", target: "[data-testid='button-sidebar-toggle']" },
    ],
  },
  {
    path: "/",
    target: "[data-testid='input-global-search']",
    title: "Global Search",
    narration: "This is the global search bar. You can search for items, orders, and customers from anywhere in the system. Just type at least 2 characters and results will appear instantly.",
    mp3File: "tut2.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='input-global-search']" },
      { triggerTime: 1.5, type: "click", target: "[data-testid='input-global-search']" },
      { triggerTime: 2.5, type: "type", target: "[data-testid='input-global-search']", value: "steel", revert: true },
      { triggerTime: 5, type: "clickFirst", target: "[data-testid^='search-result-']" },
      { triggerTime: 8, type: "highlight", target: "[data-testid='input-global-search']", highlightType: "small-circle" },
    ],
  },
  {
    path: "/",
    target: "[data-testid='card-earnings']",
    title: "Dashboard Overview",
    narration: "This is your dashboard. It shows summary cards with total earnings, orders, customers, and pending balance. Each card has a trend badge showing percentage change compared to the previous period. You can filter each card by daily, weekly, monthly, or yearly.",
    mp3File: "tut3.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='card-earnings']" },
      { triggerTime: 2, type: "move", target: "[data-testid='card-orders']" },
      { triggerTime: 3.5, type: "move", target: "[data-testid='card-customers']" },
      { triggerTime: 5, type: "move", target: "[data-testid='card-balance']" },
      { triggerTime: 6.5, type: "move", target: "[data-testid='card-earnings']" },
      { triggerTime: 7.5, type: "click", target: "[data-testid='card-earnings'] [data-testid='select-period-filter']" },
      { triggerTime: 9, type: "move", target: "[data-testid='card-earnings']" },
    ],
  },
  {
    path: "/",
    target: "[data-testid='section-revenue']",
    title: "Revenue Chart & Voice Insight",
    narration: "This is the revenue chart showing your revenue and order trends. You can double-click on any chart or summary card to get AI-powered voice insights about that data point. Try it after the tutorial!",
    mp3File: "tut4.mp3",
    actions: [
      { triggerTime: 0.5, type: "scroll", target: "[data-testid='section-revenue']" },
      { triggerTime: 1, type: "move", target: "[data-testid='section-revenue']" },
      { triggerTime: 3, type: "move", target: "[data-testid='value-revenue-total']" },
      { triggerTime: 4, type: "hover", target: "[data-testid='value-revenue-total']" },
      { triggerTime: 5.5, type: "highlight", target: "[data-testid='section-revenue']", highlightType: "full" },
      { triggerTime: 7, type: "move", target: "[data-testid='section-revenue']" },
    ],
  },
  {
    path: "/inventory",
    target: "[data-testid='button-add-item']",
    title: "Inventory Management",
    narration: "This is the Inventory page. Here you can manage all your products. Click the Add Item button to add a new product with its name, category, price, quantity, and an optional image. As an admin, you can upload images directly.",
    mp3File: "tut6.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-inventory']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-add-item']" },
      { triggerTime: 3.5, type: "click", target: "[data-testid='button-add-item']" },
      { triggerTime: 4.5, type: "focusDialog" },
      { triggerTime: 7.5, type: "click", target: "body", revert: true },
    ],
  },
  {
    path: "/inventory",
    target: "[data-testid='input-search-items']",
    title: "Search & Filter Inventory",
    narration: "You can search for items by name using this search bar. You can also filter by category and switch between grid view and list view. To adjust prices or deduct stock, click the actions menu on any item.",
    mp3File: "tut7.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='input-search-items']" },
      { triggerTime: 1.5, type: "click", target: "[data-testid='input-search-items']" },
      { triggerTime: 2, type: "type", target: "[data-testid='input-search-items']", value: "ply", revert: true },
      { triggerTime: 4.5, type: "move", target: "[data-testid='button-toggle-view']" },
      { triggerTime: 5.5, type: "click", target: "[data-testid='button-toggle-view']" },
      { triggerTime: 6.5, type: "click", target: "[data-testid='button-toggle-view']" },
      { triggerTime: 8, type: "move", target: "[data-testid='input-search-items']" },
    ],
  },
  {
    path: "/orders",
    target: "[data-testid='button-create-order']",
    title: "Order Management",
    narration: "This is the Orders page. Click Create Order to place a new order. You'll need to enter the customer name, select items and quantities, choose a sales channel, and optionally add a delivery address. The total amount calculates automatically.",
    mp3File: "tut8.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-orders']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-create-order']" },
      { triggerTime: 3.5, type: "click", target: "[data-testid='button-create-order']" },
      { triggerTime: 4.5, type: "focusDialog" },
      { triggerTime: 7.5, type: "click", target: "body", revert: true },
    ],
  },
  {
    path: "/orders",
    target: "[data-testid='tab-all']",
    title: "Order Tabs",
    narration: "Orders are organized by status tabs. You can view All orders, Pending Payment, Paid, Pending Release, Released, or Cancelled orders. Click on any order to see its full details, log payments, and update its status.",
    mp3File: "tut9.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='tab-all']" },
      { triggerTime: 2, type: "move", target: "[data-testid='tab-pending-payment']" },
      { triggerTime: 2.5, type: "click", target: "[data-testid='tab-pending-payment']" },
      { triggerTime: 3.5, type: "move", target: "[data-testid='tab-paid']" },
      { triggerTime: 4, type: "click", target: "[data-testid='tab-paid']" },
      { triggerTime: 5, type: "move", target: "[data-testid='tab-all']" },
      { triggerTime: 5.5, type: "click", target: "[data-testid='tab-all']" },
    ],
  },
  {
    path: "/billing",
    target: "[data-testid='button-toggle-search']",
    title: "Billing & Payments",
    narration: "The Billing page shows all payment records. Click the search button to search by date range, order ID, GCash number, or reference number. Click on any payment to see the full order details.",
    mp3File: "tut10.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-billing']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-toggle-search']" },
      { triggerTime: 3.5, type: "click", target: "[data-testid='button-toggle-search']" },
      { triggerTime: 4.5, type: "highlight", target: "[data-testid='card-search-panel']", highlightType: "small-circle" },
      { triggerTime: 6, type: "move", target: "[data-testid='button-toggle-search']" },
    ],
  },
  {
    path: "/accounting",
    target: "[data-testid='button-add-entry']",
    title: "Accounting",
    narration: "The Accounting page has the Chart of Accounts and General Ledger. You can add new ledger entries with debit and credit amounts. The system tracks all financial transactions automatically when orders are paid.",
    mp3File: "tut11.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-accounting']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-add-entry']" },
      { triggerTime: 4, type: "hover", target: "[data-testid='button-add-entry']" },
    ],
  },
  {
    path: "/reports",
    target: "[data-testid='tab-sales']",
    title: "Reports",
    narration: "The Reports page lets you generate sales reports, inventory reports, and financial summaries. You can filter by date range and export reports for your records.",
    mp3File: "tut12.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-reports']" },
      { triggerTime: 2, type: "move", target: "[data-testid='tab-sales']" },
      { triggerTime: 3, type: "click", target: "[data-testid='tab-sales']" },
      { triggerTime: 4, type: "move", target: "[data-testid='tab-inventory']" },
      { triggerTime: 4.5, type: "click", target: "[data-testid='tab-inventory']" },
      { triggerTime: 5.5, type: "move", target: "[data-testid='tab-forecast']" },
      { triggerTime: 6, type: "click", target: "[data-testid='tab-forecast']" },
      { triggerTime: 7, type: "move", target: "[data-testid='tab-sales']" },
      { triggerTime: 7.5, type: "click", target: "[data-testid='tab-sales']" },
    ],
  },
  {
    path: "/users",
    target: "[data-testid='button-create-user']",
    title: "User Management (Admin Only)",
    narration: "As an admin, you can manage users here. Create new accounts, change roles between Admin and Employee, reset passwords, and deactivate accounts. The green dot shows who is currently online. Note: you cannot deactivate the last admin account.",
    mp3File: "tut13.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-users']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-create-user']" },
      { triggerTime: 3.5, type: "click", target: "[data-testid='button-create-user']" },
      { triggerTime: 4.5, type: "focusDialog" },
      { triggerTime: 7.5, type: "click", target: "body", revert: true },
    ],
  },
  {
    path: "/settings",
    target: "[data-testid='select-theme']",
    title: "System Settings",
    narration: "In Settings, you can customize the system appearance. Choose from different fonts, color themes, and gradient options for the sidebar. Changes apply instantly across the entire system.",
    mp3File: "tut14.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-settings']" },
      { triggerTime: 2, type: "move", target: "[data-testid='select-theme']" },
      { triggerTime: 3.5, type: "click", target: "[data-testid='select-theme']" },
      { triggerTime: 5, type: "scroll", target: "[data-testid='button-save-settings']" },
      { triggerTime: 5.5, type: "move", target: "[data-testid='button-save-settings']" },
      { triggerTime: 6.5, type: "hover", target: "[data-testid='button-save-settings']" },
    ],
  },
  {
    path: "/maintenance",
    target: "[data-testid='button-export-backup']",
    title: "Maintenance & Backup",
    narration: "The Maintenance page lets you export backups, upload and restore from previous backups, and set up automatic scheduled backups. As an admin, you have full control over system maintenance.",
    mp3File: "tut15.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-maintenance']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-export-backup']" },
      { triggerTime: 3.5, type: "hover", target: "[data-testid='button-export-backup']" },
    ],
  },
  {
    path: "/system-logs",
    target: "[data-testid='input-search-logs']",
    title: "System Logs",
    narration: "System Logs show every action taken in the system with timestamps and descriptions. You can search and filter logs to track who did what and when. Click any log entry for full details.",
    mp3File: "tut16.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-system-logs']" },
      { triggerTime: 2, type: "move", target: "[data-testid='input-search-logs']" },
      { triggerTime: 3, type: "click", target: "[data-testid='input-search-logs']" },
      { triggerTime: 3.5, type: "type", target: "[data-testid='input-search-logs']", value: "login", revert: true },
      { triggerTime: 6, type: "move", target: "[data-testid='input-search-logs']" },
    ],
  },
  {
    path: "/help",
    target: "[data-testid='text-help-title']",
    title: "Help & Support",
    narration: "The Help page has frequently asked questions covering all system features. You can also send feedback or messages to administrators if you need additional assistance. That completes the tutorial! You now know all the features of JOAP Hardware Trading system.",
    mp3File: "tut17.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-help']" },
      { triggerTime: 2, type: "move", target: "[data-testid='text-help-title']" },
      { triggerTime: 2, type: "scroll", target: "[data-testid='text-help-title']" },
      { triggerTime: 4, type: "hover", target: "[data-testid='text-help-title']" },
    ],
  },
];

const EMPLOYEE_STEPS: TutorialStep[] = [
  {
    path: "/",
    target: "[data-testid='button-sidebar-toggle']",
    title: "Welcome to JOAP Hardware Trading",
    narration: "Welcome to JOAP Hardware Trading! I'll show you how to use the system as an employee. This is the sidebar toggle for navigation.",
    mp3File: "tut1.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='button-sidebar-toggle']" },
      { triggerTime: 3, type: "click", target: "[data-testid='button-sidebar-toggle']" },
      { triggerTime: 5, type: "click", target: "[data-testid='button-sidebar-toggle']" },
    ],
  },
  {
    path: "/",
    target: "[data-testid='input-global-search']",
    title: "Global Search",
    narration: "Use this search bar to quickly find items, orders, or customers from anywhere in the system.",
    mp3File: "tut2.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='input-global-search']" },
      { triggerTime: 1.5, type: "click", target: "[data-testid='input-global-search']" },
    ],
  },
  {
    path: "/",
    target: "[data-testid='card-earnings']",
    title: "Dashboard",
    narration: "Your dashboard shows key business metrics: earnings, orders, customers, and pending balances. Each card can be filtered by time period.",
    mp3File: "tut3.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='card-earnings']" },
      { triggerTime: 2, type: "move", target: "[data-testid='card-orders']" },
      { triggerTime: 3, type: "move", target: "[data-testid='card-customers']" },
      { triggerTime: 4, type: "move", target: "[data-testid='card-balance']" },
    ],
  },
  {
    path: "/",
    target: "[data-testid='section-revenue']",
    title: "Charts & Voice Insight",
    narration: "You can double-click on any chart or card to get AI-powered voice insights about that data. A voice bubble will appear with the AI analysis.",
    mp3File: "tut4.mp3",
    actions: [
      { triggerTime: 0.5, type: "scroll", target: "[data-testid='section-revenue']" },
      { triggerTime: 1, type: "move", target: "[data-testid='section-revenue']" },
      { triggerTime: 3, type: "hover", target: "[data-testid='section-revenue']" },
    ],
  },
  {
    path: "/inventory",
    target: "[data-testid='button-add-item']",
    title: "Inventory Management",
    narration: "Here you manage inventory. You can add items, update quantities, and adjust prices. Note: when you upload an image for an item, it needs admin approval before it appears.",
    mp3File: "tut5.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-inventory']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-add-item']" },
      { triggerTime: 4, type: "hover", target: "[data-testid='button-add-item']" },
    ],
  },
  {
    path: "/inventory",
    target: "[data-testid='input-search-items']",
    title: "Search Inventory",
    narration: "Search for items by name, filter by category, and switch between grid and list views. Use the actions menu to deduct stock or adjust prices.",
    mp3File: "tut6.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='input-search-items']" },
      { triggerTime: 1.5, type: "click", target: "[data-testid='input-search-items']" },
      { triggerTime: 2, type: "type", target: "[data-testid='input-search-items']", value: "ply", revert: true },
    ],
  },
  {
    path: "/orders",
    target: "[data-testid='button-create-order']",
    title: "Creating Orders",
    narration: "Create new orders here. Enter the customer name, add items with quantities, choose the sales channel, and optionally add a delivery address. The system calculates totals automatically.",
    mp3File: "tut7.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-orders']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-create-order']" },
      { triggerTime: 4, type: "hover", target: "[data-testid='button-create-order']" },
    ],
  },
  {
    path: "/orders",
    target: "[data-testid='tab-all']",
    title: "Order Status",
    narration: "View orders by status using these tabs. Click any order to see details, log payments, or update the order status as it progresses.",
    mp3File: "tut8.mp3",
    actions: [
      { triggerTime: 0.5, type: "move", target: "[data-testid='tab-all']" },
      { triggerTime: 2, type: "move", target: "[data-testid='tab-pending-payment']" },
      { triggerTime: 2.5, type: "click", target: "[data-testid='tab-pending-payment']" },
      { triggerTime: 3.5, type: "move", target: "[data-testid='tab-all']" },
      { triggerTime: 4, type: "click", target: "[data-testid='tab-all']" },
    ],
  },
  {
    path: "/billing",
    target: "[data-testid='button-toggle-search']",
    title: "Billing",
    narration: "The Billing page shows all payments. Click the search button to search by date, order ID, GCash number, or reference number. Click any record to see the full order.",
    mp3File: "tut9.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-billing']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-toggle-search']" },
      { triggerTime: 4, type: "hover", target: "[data-testid='button-toggle-search']" },
    ],
  },
  {
    path: "/accounting",
    target: "[data-testid='button-add-entry']",
    title: "Accounting",
    narration: "View the Chart of Accounts and General Ledger here. These show all financial records and transactions in the system.",
    mp3File: "tut10.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-accounting']" },
      { triggerTime: 2, type: "move", target: "[data-testid='button-add-entry']" },
      { triggerTime: 4, type: "hover", target: "[data-testid='button-add-entry']" },
    ],
  },
  {
    path: "/reports",
    target: "[data-testid='tab-sales']",
    title: "Reports",
    narration: "Generate and export sales, inventory, and financial reports filtered by date range.",
    mp3File: "tut11.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-reports']" },
      { triggerTime: 2, type: "move", target: "[data-testid='tab-sales']" },
      { triggerTime: 2.5, type: "click", target: "[data-testid='tab-sales']" },
      { triggerTime: 3.5, type: "move", target: "[data-testid='tab-inventory']" },
      { triggerTime: 4, type: "click", target: "[data-testid='tab-inventory']" },
      { triggerTime: 5, type: "click", target: "[data-testid='tab-sales']" },
      { triggerTime: 5, type: "move", target: "[data-testid='tab-sales']" },
    ],
  },
  {
    path: "/help",
    target: "[data-testid='text-help-title']",
    title: "Help",
    narration: "Check the FAQs for answers to common questions, or send a message to your admin for help. That's everything you need to know! Enjoy using the system.",
    mp3File: "tut12.mp3",
    actions: [
      { triggerTime: 0.3, type: "navigate", target: "[data-testid='nav-help']" },
      { triggerTime: 2, type: "move", target: "[data-testid='text-help-title']" },
      { triggerTime: 3, type: "scroll", target: "[data-testid='text-help-title']" },
    ],
  },
];

interface SavedSettings {
  colorTheme: string;
  gradient: string;
  font: string;
}

interface TutorialProps {
  isAdmin: boolean;
  onComplete: (savedSettings?: SavedSettings) => void;
}

type StepPhase = "loading" | "playing" | "ready";

function safeClick(el: Element) {
  if (typeof (el as HTMLElement).click === "function") {
    (el as HTMLElement).click();
  } else {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }
}

export function Tutorial({ isAdmin, onComplete }: TutorialProps) {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [narrationText, setNarrationText] = useState("");
  const [displayedWords, setDisplayedWords] = useState("");
  const [phase, setPhase] = useState<StepPhase>("loading");
  const [isMuted, setIsMuted] = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);
  const [hoverRing, setHoverRing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioAbortRef = useRef<AbortController | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const targetElRef = useRef<HTMLElement | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHighlightRef = useRef<string | null>(null);
  const actionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typedElementsRef = useRef<Array<{ el: HTMLInputElement; original: string }>>([]);
  const savedSettingsRef = useRef<SavedSettings | null>(null);
  const previewAppliedRef = useRef(false);
  const stepIdRef = useRef(0);

  const steps = isAdmin ? ADMIN_STEPS : EMPLOYEE_STEPS;
  const step = steps[currentStep];
  const SETTINGS_STEP_INDEX = isAdmin ? 13 : -1;

  const PREVIEW_THEMES = [
    { colorTheme: "purple", gradient: "purple-pink", font: "Poppins" },
    { colorTheme: "emerald", gradient: "emerald-teal", font: "Montserrat" },
    { colorTheme: "rose", gradient: "rose-orange", font: "Nunito" },
    { colorTheme: "teal", gradient: "teal-cyan", font: "Raleway" },
  ];

  const COLOR_THEMES_MAP: Record<string, { primary: string; primaryForeground: string }> = {
    blue: { primary: "217 91% 60%", primaryForeground: "0 0% 100%" },
    emerald: { primary: "160 84% 39%", primaryForeground: "0 0% 100%" },
    purple: { primary: "271 91% 65%", primaryForeground: "0 0% 100%" },
    rose: { primary: "350 89% 60%", primaryForeground: "0 0% 100%" },
    orange: { primary: "25 95% 53%", primaryForeground: "0 0% 100%" },
    teal: { primary: "173 80% 40%", primaryForeground: "0 0% 100%" },
    indigo: { primary: "239 84% 67%", primaryForeground: "0 0% 100%" },
    amber: { primary: "38 92% 50%", primaryForeground: "0 0% 0%" },
    cyan: { primary: "189 94% 43%", primaryForeground: "0 0% 100%" },
    slate: { primary: "215 20% 45%", primaryForeground: "0 0% 100%" },
  };

  const GRADIENT_MAP: Record<string, string> = {
    none: "",
    "blue-purple": "linear-gradient(135deg, #2563eb, #9333ea)",
    "emerald-teal": "linear-gradient(135deg, #059669, #0d9488)",
    "rose-orange": "linear-gradient(135deg, #e11d48, #ea580c)",
    "purple-pink": "linear-gradient(135deg, #9333ea, #ec4899)",
    "teal-cyan": "linear-gradient(135deg, #0d9488, #06b6d4)",
    "orange-amber": "linear-gradient(135deg, #ea580c, #d97706)",
  };

  const applyThemePreview = useCallback(() => {
    if (!savedSettingsRef.current || previewAppliedRef.current) return;
    const saved = savedSettingsRef.current;
    const candidates = PREVIEW_THEMES.filter(t => t.colorTheme !== saved.colorTheme);
    const preview = candidates[Math.floor(Math.random() * candidates.length)];
    const root = document.documentElement;
    const theme = COLOR_THEMES_MAP[preview.colorTheme];
    if (theme) {
      root.style.setProperty("--primary", theme.primary);
      root.style.setProperty("--primary-foreground", theme.primaryForeground);
    }
    const gradCss = GRADIENT_MAP[preview.gradient] || "";
    if (gradCss) {
      root.style.setProperty("--sidebar-gradient", gradCss);
    }
    previewAppliedRef.current = true;
  }, []);

  const revertThemePreview = useCallback(() => {
    if (!previewAppliedRef.current || !savedSettingsRef.current) return;
    const saved = savedSettingsRef.current;
    const root = document.documentElement;
    const theme = COLOR_THEMES_MAP[saved.colorTheme];
    if (theme) {
      root.style.setProperty("--primary", theme.primary);
      root.style.setProperty("--primary-foreground", theme.primaryForeground);
    }
    const gradCss = GRADIENT_MAP[saved.gradient] || "";
    if (gradCss) {
      root.style.setProperty("--sidebar-gradient", gradCss);
    } else {
      root.style.removeProperty("--sidebar-gradient");
    }
    previewAppliedRef.current = false;
  }, []);

  useEffect(() => {
    async function captureSettings() {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/settings", { headers, credentials: "include" });
        const data = await res.json();
        if (data.success && data.data) {
          savedSettingsRef.current = {
            colorTheme: data.data.colorTheme || "blue",
            gradient: data.data.gradient || "none",
            font: data.data.font || "Inter",
          };
        }
      } catch {}
    }
    captureSettings();

    return () => {
      const audio = audioElRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        audioElRef.current = null;
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioAbortRef.current) {
      audioAbortRef.current.abort();
      audioAbortRef.current = null;
    }
    const audio = audioElRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.src = "";
      audioElRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopAudio();
    if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    pendingHighlightRef.current = null;
    revertThemePreview();
    actionTimersRef.current.forEach(t => clearTimeout(t));
    actionTimersRef.current = [];
    typedElementsRef.current.forEach(({ el, original }) => {
      try {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, original);
        } else {
          el.value = original;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch {}
    });
    typedElementsRef.current = [];
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escEvent);
    setHoverRing(null);
    setCursorClicking(false);
  }, [revertThemePreview, stopAudio]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; cleanup(); };
  }, [cleanup]);

  const handleComplete = useCallback(() => {
    cleanup();
    onComplete(savedSettingsRef.current || undefined);
  }, [cleanup, onComplete]);

  const showHighlight = useCallback((selector: string, guardId: number, attempt = 0) => {
    if (guardId !== stepIdRef.current) return;
    const el = document.querySelector(selector) as HTMLElement | null;
    targetElRef.current = el;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => {
        if (!isMountedRef.current || guardId !== stepIdRef.current) return;
        if (pendingHighlightRef.current !== selector) return;
        const rect = el.getBoundingClientRect();
        setSpotlightRect(rect);
        setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }, 500);
      actionTimersRef.current.push(timer);
    } else if (attempt < 8) {
      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && guardId === stepIdRef.current && pendingHighlightRef.current === selector) {
          showHighlight(selector, guardId, attempt + 1);
        }
      }, 400);
    } else {
      setSpotlightRect(null);
      setCursorPos(null);
    }
  }, []);

  const advanceStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length, handleComplete]);

  const executeAction = useCallback((action: CursorAction, guardId: number) => {
    if (!isMountedRef.current || guardId !== stepIdRef.current) return;

    const getEl = (selector?: string) => {
      if (!selector) return null;
      if (selector === "body") return document.body;
      const parts = selector.split(", ");
      for (const part of parts) {
        try {
          const el = document.querySelector(part.trim()) as HTMLElement | null;
          if (el) return el;
        } catch {}
      }
      return null;
    };

    const syncToEl = (el: Element) => {
      const rect = el.getBoundingClientRect();
      setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setSpotlightRect(rect);
      targetElRef.current = el as HTMLElement;
    };

    switch (action.type) {
      case "move": {
        if (action.target) {
          const el = getEl(action.target);
          if (el) syncToEl(el);
        }
        break;
      }
      case "click": {
        if (action.target) {
          const el = getEl(action.target);
          if (el) {
            syncToEl(el);
            setCursorClicking(true);
            const timer = setTimeout(() => {
              if (!isMountedRef.current || guardId !== stepIdRef.current) return;
              setCursorClicking(false);
              safeClick(el);
              if (action.revert) {
                const revertTimer = setTimeout(() => {
                  if (!isMountedRef.current || guardId !== stepIdRef.current) return;
                  const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                  document.dispatchEvent(escEvent);
                  const closeBtns = [
                    "[role='dialog'] [data-testid*='close']",
                    "[role='dialog'] button[aria-label='Close']",
                    "button[data-testid='button-close-dialog']",
                    "[role='dialog'] .absolute.right-4.top-4",
                  ];
                  for (const sel of closeBtns) {
                    const btn = document.querySelector(sel) as HTMLElement;
                    if (btn) { safeClick(btn); break; }
                  }
                }, 2000);
                actionTimersRef.current.push(revertTimer);
              }
            }, 200);
            actionTimersRef.current.push(timer);
          }
        }
        break;
      }
      case "clickFirst": {
        if (action.target) {
          const findAndClick = (attempt = 0) => {
            if (!isMountedRef.current || guardId !== stepIdRef.current) return;
            const el = getEl(action.target);
            if (el) {
              syncToEl(el);
              setCursorClicking(true);
              const timer = setTimeout(() => {
                if (!isMountedRef.current || guardId !== stepIdRef.current) return;
                setCursorClicking(false);
                safeClick(el);
              }, 300);
              actionTimersRef.current.push(timer);
            } else if (attempt < 8) {
              const retry = setTimeout(() => findAndClick(attempt + 1), 400);
              actionTimersRef.current.push(retry);
            }
          };
          findAndClick();
        }
        break;
      }
      case "doubleClick": {
        if (action.target) {
          const el = getEl(action.target);
          if (el) {
            syncToEl(el);
            setCursorClicking(true);
            const timer = setTimeout(() => {
              if (!isMountedRef.current || guardId !== stepIdRef.current) return;
              setCursorClicking(false);
              el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            }, 200);
            actionTimersRef.current.push(timer);
          }
        }
        break;
      }
      case "type": {
        if (action.target && action.value) {
          const el = getEl(action.target) as HTMLInputElement | null;
          if (el) {
            el.focus();
            safeClick(el);
            const originalValue = el.value;
            if (action.revert) {
              typedElementsRef.current.push({ el, original: originalValue });
            }
            const chars = action.value.split("");
            let charIdx = 0;
            const typeInterval = setInterval(() => {
              if (!isMountedRef.current || guardId !== stepIdRef.current || charIdx >= chars.length) {
                clearInterval(typeInterval);
                return;
              }
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              const newVal = action.value!.slice(0, charIdx + 1);
              if (nativeInputValueSetter) {
                nativeInputValueSetter.call(el, newVal);
              } else {
                el.value = newVal;
              }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              charIdx++;
            }, 120);
            actionTimersRef.current.push(typeInterval as unknown as ReturnType<typeof setTimeout>);
          }
        }
        break;
      }
      case "pressEnter": {
        if (action.target) {
          const el = getEl(action.target) as HTMLInputElement | null;
          if (el) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
          }
        }
        break;
      }
      case "hover": {
        if (action.target) {
          const el = getEl(action.target);
          if (el) {
            syncToEl(el);
            const rect = el.getBoundingClientRect();
            setHoverRing({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
            const timer = setTimeout(() => {
              if (isMountedRef.current) setHoverRing(null);
            }, 1500);
            actionTimersRef.current.push(timer);
          }
        }
        break;
      }
      case "highlight": {
        if (action.target) {
          const el = getEl(action.target);
          if (el) syncToEl(el);
        }
        break;
      }
      case "scroll": {
        if (action.target) {
          const el = getEl(action.target);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
        break;
      }
      case "navigate": {
        if (action.target) {
          const el = getEl(action.target);
          if (el) {
            syncToEl(el);
            setCursorClicking(true);
            const timer = setTimeout(() => {
              if (!isMountedRef.current || guardId !== stepIdRef.current) return;
              setCursorClicking(false);
              safeClick(el);
            }, 500);
            actionTimersRef.current.push(timer);
          }
        }
        break;
      }
      case "focusDialog": {
        const findDialog = (attempt = 0) => {
          if (!isMountedRef.current || guardId !== stepIdRef.current) return;
          const dialog = document.querySelector("[role='dialog']") as HTMLElement | null;
          if (dialog) {
            syncToEl(dialog);
          } else if (attempt < 10) {
            const retryTimer = setTimeout(() => findDialog(attempt + 1), 300);
            actionTimersRef.current.push(retryTimer);
          }
        };
        findDialog();
        break;
      }
    }
  }, []);

  const scheduleActions = useCallback((actions: CursorAction[], guardId: number) => {
    actions.forEach(action => {
      const timer = setTimeout(() => {
        if (isMountedRef.current && guardId === stepIdRef.current) {
          executeAction(action, guardId);
        }
      }, action.triggerTime * 1000);
      actionTimersRef.current.push(timer);
    });
  }, [executeAction]);

  useEffect(() => {
    if (!step || !isMountedRef.current) return;

    const thisStepId = ++stepIdRef.current;

    cleanup();
    setPhase("loading");
    setNarrationText(step.narration);
    setDisplayedWords("");
    setSpotlightRect(null);
    setCursorPos(null);

    navigate(step.path);
    pendingHighlightRef.current = step.target;

    const words = step.narration.split(" ");
    let wordIndex = 0;

    const revealHighlight = () => {
      if (thisStepId !== stepIdRef.current) return;
      if (pendingHighlightRef.current === step.target) {
        showHighlight(step.target, thisStepId);
      }
    };

    const startWordReveal = (durationMs: number) => {
      const msPerWord = Math.max(100, durationMs / words.length);
      wordTimerRef.current = setInterval(() => {
        if (!isMountedRef.current || thisStepId !== stepIdRef.current) {
          if (wordTimerRef.current) clearInterval(wordTimerRef.current);
          return;
        }
        if (wordIndex < words.length) {
          setDisplayedWords(words.slice(0, wordIndex + 1).join(" "));
          wordIndex++;
        } else {
          if (wordTimerRef.current) clearInterval(wordTimerRef.current);
        }
      }, msPerWord);
    };

    const finishStep = () => {
      if (!isMountedRef.current || thisStepId !== stepIdRef.current) return;
      setDisplayedWords(step.narration);
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
      setPhase("ready");
    };

    scheduleActions(step.actions, thisStepId);

    if (currentStep === SETTINGS_STEP_INDEX) {
      const previewTimer = setTimeout(() => {
        if (isMountedRef.current && thisStepId === stepIdRef.current) applyThemePreview();
      }, 2000);
      actionTimersRef.current.push(previewTimer);
    }

    const mp3 = step.mp3File;

    const setupTimer = setTimeout(() => {
      if (!isMountedRef.current || thisStepId !== stepIdRef.current) return;

      if (!isMuted) {
        const audio = new Audio();
        audioElRef.current = audio;
        const abortCtrl = new AbortController();
        audioAbortRef.current = abortCtrl;
        const signal = abortCtrl.signal;

        let played = false;
        const onCanPlay = () => {
          if (played || signal.aborted) return;
          played = true;
          if (!isMountedRef.current || thisStepId !== stepIdRef.current) {
            audio.pause();
            return;
          }
          setPhase("playing");
          revealHighlight();
          const audioDuration = audio.duration || (words.length * 0.35);
          startWordReveal(audioDuration * 1000);
          audio.onended = finishStep;
          audio.onerror = finishStep;
          audio.play().catch(() => finishStep());
        };

        audio.addEventListener("canplaythrough", onCanPlay, { once: true, signal });
        audio.addEventListener("error", () => {
          if (signal.aborted || thisStepId !== stepIdRef.current) return;
          fallbackNoAudio();
        }, { once: true, signal });

        audio.src = `/api/tutorial-audio/${mp3}`;
        audio.load();

        const timeoutId = setTimeout(() => {
          if (signal.aborted || thisStepId !== stepIdRef.current) return;
          onCanPlay();
        }, 5000);
        actionTimersRef.current.push(timeoutId);
      } else {
        fallbackNoAudio();
      }

      function fallbackNoAudio() {
        if (!isMountedRef.current || thisStepId !== stepIdRef.current) return;
        setPhase("playing");
        revealHighlight();
        const msPerWord = 200;
        wordTimerRef.current = setInterval(() => {
          if (!isMountedRef.current || thisStepId !== stepIdRef.current) {
            if (wordTimerRef.current) clearInterval(wordTimerRef.current);
            return;
          }
          if (wordIndex < words.length) {
            setDisplayedWords(words.slice(0, wordIndex + 1).join(" "));
            wordIndex++;
          } else {
            if (wordTimerRef.current) clearInterval(wordTimerRef.current);
            setPhase("ready");
          }
        }, msPerWord);
      }
    }, 100);
    actionTimersRef.current.push(setupTimer);

    return () => {
      stopAudio();
      actionTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, [currentStep]);

  const skipStep = () => {
    cleanup();
    advanceStep();
  };

  const handleNext = () => {
    cleanup();
    advanceStep();
  };

  const handleSpotlightClick = () => {
    if (phase === "ready" && targetElRef.current) {
      safeClick(targetElRef.current);
    }
  };

  const overallProgress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  const showSpotlight = phase !== "loading" && spotlightRect;

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="tutorial-overlay">
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 9999 }}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {showSpotlight && (
              <rect
                x={spotlightRect.left - 16}
                y={spotlightRect.top - 16}
                width={spotlightRect.width + 32}
                height={spotlightRect.height + 32}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#tutorial-mask)"
        />
      </svg>

      {showSpotlight && phase === "ready" && (
        <div
          className="fixed cursor-pointer"
          style={{
            left: spotlightRect.left - 16,
            top: spotlightRect.top - 16,
            width: spotlightRect.width + 32,
            height: spotlightRect.height + 32,
            zIndex: 10001,
            borderRadius: "12px",
          }}
          onClick={handleSpotlightClick}
          data-testid="tutorial-spotlight-clickable"
        />
      )}

      {showSpotlight && (
        <div
          className="fixed pointer-events-none border-2 border-primary animate-pulse"
          style={{
            left: spotlightRect.left - 20,
            top: spotlightRect.top - 20,
            width: spotlightRect.width + 40,
            height: spotlightRect.height + 40,
            zIndex: 10000,
            borderRadius: "14px",
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.4), inset 0 0 20px rgba(59, 130, 246, 0.1)",
          }}
        />
      )}

      {hoverRing && (
        <div
          className="fixed pointer-events-none rounded-lg border-2 border-blue-400 animate-pulse"
          style={{
            left: hoverRing.x - 4,
            top: hoverRing.y - 4,
            width: hoverRing.w + 8,
            height: hoverRing.h + 8,
            zIndex: 10000,
            boxShadow: "0 0 12px rgba(59, 130, 246, 0.4)",
          }}
        />
      )}

      {cursorPos && (
        <div
          className="fixed pointer-events-none hidden sm:block"
          style={{
            left: cursorPos.x - 12,
            top: cursorPos.y - 4,
            zIndex: 10002,
            transition: "left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s ease",
            transform: cursorClicking ? "scale(0.75)" : "scale(1)",
          }}
        >
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
            <path
              d="M5 2L5 20L9.5 16L13 24L16 22.5L12.5 15L18 14L5 2Z"
              fill="white"
              stroke="black"
              strokeWidth="1.5"
            />
          </svg>
          <div className="absolute top-0 left-0 w-8 h-8 rounded-full bg-primary/30 animate-ping" />
        </div>
      )}

      <div
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-2xl"
        style={{ zIndex: 10003 }}
        data-testid="tutorial-narration-panel"
      >
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <div className="max-w-3xl mx-auto px-3 py-3 sm:p-4">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-primary">{currentStep + 1}/{steps.length}</span>
              </div>
              <h3 className="font-semibold text-xs sm:text-sm truncate" data-testid="text-tutorial-title">{step?.title}</h3>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "Unmute" : "Mute"}
                data-testid="button-tutorial-mute"
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-1.5 sm:px-2"
                onClick={skipStep}
                data-testid="button-tutorial-skip"
              >
                <SkipForward className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Skip</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleComplete()}
                data-testid="button-tutorial-end"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="min-h-[40px] sm:min-h-[48px] flex items-center gap-2 sm:gap-3" data-testid="text-tutorial-narration">
            {phase === "loading" ? (
              <div className="flex items-center gap-2 sm:gap-3 w-full justify-center py-1">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <p className="text-xs sm:text-sm leading-relaxed text-foreground/90 flex-1">
                  {displayedWords}
                  {phase === "playing" && (
                    <span className="inline-block w-0.5 h-3.5 sm:h-4 bg-primary ml-0.5 animate-pulse" />
                  )}
                </p>
                {phase === "ready" && (
                  <Button
                    size="sm"
                    className="shrink-0 gap-1 text-xs sm:text-sm h-8"
                    onClick={handleNext}
                    data-testid="button-tutorial-next"
                  >
                    {isLastStep ? "Finish" : "Next"} <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
