import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { X, SkipForward, Volume2, VolumeX, ChevronRight } from "lucide-react";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  TUTORIAL OVERHAUL GUIDE — READ task.txt FOR FULL INSTRUCTIONS             ║
// ║                                                                            ║
// ║  CURRENT STATE: Tutorial uses Gemini TTS API calls (POST /api/voice-insight)║
// ║  GOAL: Replace with local MP3 files from /tutorial_mp3/tut1.mp3 to tut17.mp3║
// ║                                                                            ║
// ║  MP3 FILES: Served via GET /api/tutorial-audio/:filename                   ║
// ║  (route needs to be added in server/routes.ts — see comments there)         ║
// ║                                                                            ║
// ║  PHASE 2 — "ALIVE CURSOR" SYSTEM:                                         ║
// ║  Each step needs a "choreography" array of timed actions that sync with    ║
// ║  the MP3 narration. The cursor should move, click, hover, type, switch     ║
// ║  tabs, etc. based on keyword timestamps in each MP3.                       ║
// ║                                                                            ║
// ║  See the `actions` field in each step below for choreography instructions. ║
// ║  See task.txt for the full specification.                                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

interface TutorialStep {
  path: string;
  target: string;
  title: string;
  narration: string;
  // FUTURE: Add these fields for the alive cursor system:
  // mp3File: string;        — e.g. "tut1.mp3"
  // actions: CursorAction[] — timed choreography array, see task.txt
}

const ADMIN_STEPS: TutorialStep[] = [
  // ── TUT1: tut1.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Start: full-screen highlight on dashboard
  // 2. On "sidebar toggle" → move cursor to sidebar toggle, click it (expand sidebar)
  // 3. On "expand or collapse" → click it again (collapse sidebar)
  // 4. End: small-circle focus on sidebar toggle
  {
    path: "/",
    target: "[data-testid='button-sidebar-toggle']",
    title: "Welcome to JOAP Hardware Trading",
    narration: "Welcome to JOAP Hardware Trading management system! I'll guide you through all the features. This is the sidebar toggle. You can click it to expand or collapse the navigation menu on the left side.",
  },
  // ── TUT2: tut2.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Move cursor to search bar, click it (focus the input)
  // 2. On "search" → type "cement" letter by letter into the search bar
  // 3. On "results" → wait for dropdown results to appear, hover over first result
  // 4. On "instantly" → clear the typed text, small-circle focus on search bar
  {
    path: "/",
    target: "[data-testid='input-global-search']",
    title: "Global Search",
    narration: "This is the global search bar. You can search for items, orders, and customers from anywhere in the system. Just type at least 2 characters and results will appear instantly.",
  },
  // ── TUT3: tut3.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Full-screen highlight on dashboard area
  // 2. On "earnings" → move cursor to earnings card, hover highlight
  // 3. On "orders" → move cursor to orders card
  // 4. On "customers" → move cursor to customers card
  // 5. On "pending" → move cursor to pending balance card
  // 6. On "filter" → click a period dropdown on earnings card, select "weekly"
  // 7. End: small-circle focus on earnings card
  {
    path: "/",
    target: "[data-testid='card-earnings']",
    title: "Dashboard Overview",
    narration: "This is your dashboard. It shows summary cards with total earnings, orders, customers, and pending balance. Each card has a trend badge showing percentage change compared to the previous period. You can filter each card by daily, weekly, monthly, or yearly.",
  },
  // ── TUT4: tut4.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Full-screen highlight on revenue chart section
  // 2. On "revenue" → move cursor over the chart bars slowly
  // 3. On "double-click" → double-click on a chart bar (trigger voice insight)
  // 4. Wait briefly to show the voice insight bubble appearing
  // 5. Close the voice insight bubble
  // 6. End: small-circle focus on revenue section
  {
    path: "/",
    target: "[data-testid='section-revenue']",
    title: "Revenue Chart & Voice Insight",
    narration: "This is the revenue chart showing your revenue and order trends. You can double-click on any chart or summary card to get AI-powered voice insights about that data point. Try it after the tutorial!",
  },
  // ── TUT5: tut5.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Scroll down to map section, full-screen highlight
  // 2. On "colored dots" → move cursor to a city dot on the map
  // 3. On "Click a dot" → click the dot (show info panel with order count + revenue)
  // 4. On "double-click" → double-click the dot (trigger Gemini AI query)
  // 5. Show AI response appearing, then close it
  // 6. On "activity" → type "how many sales did we have based on this?" in the Gemini input
  // 7. End: small-circle focus on map card
  {
    path: "/",
    target: "[data-testid='card-customer-map']",
    title: "Customer Distribution Map",
    narration: "This is the customer distribution map. It shows where your orders are coming from across the Philippines. Colored dots represent cities with orders. Click a dot to see details, or double-click to ask the AI assistant about that city's activity.",
  },
  // ── TUT6: tut6.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Inventory" nav link
  // 2. Full-screen highlight on inventory page
  // 3. On "Add Item" → move cursor to Add Item button, hover it
  // 4. On "click" → click Add Item button (open dialog)
  // 5. Show the dialog briefly, then close it
  // 6. End: small-circle focus on Add Item button
  {
    path: "/inventory",
    target: "[data-testid='button-add-item']",
    title: "Inventory Management",
    narration: "This is the Inventory page. Here you can manage all your products. Click the Add Item button to add a new product with its name, category, price, quantity, and an optional image. As an admin, you can upload images directly.",
  },
  // ── TUT7: tut7.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Move cursor to search bar, click it
  // 2. On "search" → type "ply" letter by letter
  // 3. On "filter by category" → click category dropdown, hover over options
  // 4. On "grid view" → click grid/list toggle button
  // 5. On "list view" → click toggle again
  // 6. On "actions menu" → move to an item's actions button, click it, show dropdown
  // 7. End: small-circle focus on search bar
  {
    path: "/inventory",
    target: "[data-testid='input-search-items']",
    title: "Search & Filter Inventory",
    narration: "You can search for items by name using this search bar. You can also filter by category and switch between grid view and list view. To adjust prices or deduct stock, click the actions menu on any item.",
  },
  // ── TUT8: tut8.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Orders" nav link
  // 2. Full-screen highlight on orders page
  // 3. On "Create Order" → move cursor to Create Order button, click it (open dialog)
  // 4. On "customer name" → type "Juan" in customer name field
  // 5. On "sales channel" → click channel dropdown, hover options
  // 6. On "delivery address" → check delivery address checkbox
  // 7. Close dialog
  // 8. End: small-circle focus on Create Order button
  {
    path: "/orders",
    target: "[data-testid='button-create-order']",
    title: "Order Management",
    narration: "This is the Orders page. Click Create Order to place a new order. You'll need to enter the customer name, select items and quantities, choose a sales channel, and optionally add a delivery address. The total amount calculates automatically.",
  },
  // ── TUT9: tut9.mp3 ─────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Move cursor across the status tabs one by one
  // 2. On "Pending Payment" → click Pending Payment tab
  // 3. On "Paid" → click Paid tab
  // 4. On "Released" → click Released tab
  // 5. On "All" → click All tab back
  // 6. On "click on any order" → click first order row (navigate to detail)
  // 7. Wait briefly, then navigate back to orders
  // 8. End: small-circle focus on All tab
  {
    path: "/orders",
    target: "[data-testid='tab-all']",
    title: "Order Tabs",
    narration: "Orders are organized by status tabs. You can view All orders, Pending Payment, Paid, Pending Release, Released, or Cancelled orders. Click on any order to see its full details, log payments, and update its status.",
  },
  // ── TUT10: tut10.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Billing" nav link
  // 2. Full-screen highlight on billing page
  // 3. On "search button" → move cursor to search toggle, click it (expand search panel)
  // 4. On "date range" → click Date tab in search
  // 5. On "GCash" → click GCash tab
  // 6. On "reference" → click Reference tab
  // 7. On "click on any payment" → hover over a payment row
  // 8. Close search panel
  // 9. End: small-circle focus on search toggle
  {
    path: "/billing",
    target: "[data-testid='button-toggle-search']",
    title: "Billing & Payments",
    narration: "The Billing page shows all payment records. Click the search button to search by date range, order ID, GCash number, or reference number. Click on any payment to see the full order details.",
  },
  // ── TUT11: tut11.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Accounting" nav link
  // 2. Full-screen highlight on accounting page
  // 3. On "Chart of Accounts" → highlight chart of accounts section
  // 4. On "General Ledger" → click General Ledger tab/section
  // 5. On "add new" → move cursor to Add Entry button, hover it
  // 6. End: small-circle focus on Add Entry button
  {
    path: "/accounting",
    target: "[data-testid='button-add-entry']",
    title: "Accounting",
    narration: "The Accounting page has the Chart of Accounts and General Ledger. You can add new ledger entries with debit and credit amounts. The system tracks all financial transactions automatically when orders are paid.",
  },
  // ── TUT12: tut12.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Reports" nav link
  // 2. Full-screen highlight on reports page
  // 3. On "sales" → click Sales tab
  // 4. On "inventory" → click Inventory tab
  // 5. On "financial" → click Financial tab
  // 6. On "export" → move cursor to export/download button, hover it
  // 7. End: small-circle focus on Sales tab
  {
    path: "/reports",
    target: "[data-testid='tab-sales']",
    title: "Reports",
    narration: "The Reports page lets you generate sales reports, inventory reports, and financial summaries. You can filter by date range and export reports for your records.",
  },
  // ── TUT13: tut13.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Users" nav link
  // 2. Full-screen highlight on users page
  // 3. On "Create" → move cursor to Create User button, click it (open dialog)
  // 4. Show dialog briefly, close it
  // 5. On "green dot" → move cursor to a user's online status dot
  // 6. On "roles" → hover over a user's role badge
  // 7. End: small-circle focus on Create User button
  {
    path: "/users",
    target: "[data-testid='button-create-user']",
    title: "User Management (Admin Only)",
    narration: "As an admin, you can manage users here. Create new accounts, change roles between Admin and Employee, reset passwords, and deactivate accounts. The green dot shows who is currently online. Note: you cannot deactivate the last admin account.",
  },
  // ── TUT14: tut14.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Settings" nav link
  // 2. Full-screen highlight on settings page
  // 3. On "fonts" → click font dropdown, hover over font options
  // 4. On "color themes" → move to color theme selector, pick a random color
  // 5. On "gradient" → move to gradient selector, pick a random gradient, click apply
  // 6. IMPORTANT: Show the preview (theme changes visually) BUT revert all
  //    settings changes when tutorial ends — save original settings at start,
  //    restore them in onComplete callback
  // 7. End: small-circle focus on theme selector
  {
    path: "/settings",
    target: "[data-testid='select-theme']",
    title: "System Settings",
    narration: "In Settings, you can customize the system appearance. Choose from different fonts, color themes, and gradient options for the sidebar. Changes apply instantly across the entire system.",
  },
  // ── TUT15: tut15.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Maintenance" nav link
  // 2. Full-screen highlight on maintenance page
  // 3. On "export" → move cursor to Export Backup button, hover it
  // 4. On "upload" → move cursor to Upload area
  // 5. On "automatic" → move cursor to auto-backup toggle
  // 6. End: small-circle focus on Export Backup button
  // TRANSITION TO TUT16: cursor moves to sidebar, hovers "System Logs",
  //   then clicks it — page navigates while still in focus
  {
    path: "/maintenance",
    target: "[data-testid='button-export-backup']",
    title: "Maintenance & Backup",
    narration: "The Maintenance page lets you export backups, upload and restore from previous backups, and set up automatic scheduled backups. As an admin, you have full control over system maintenance.",
  },
  // ── TUT16: tut16.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Full-screen highlight on system logs page
  // 2. On "search" → move cursor to search box, click it, type "login" letter by letter
  // 3. On "filter" → move to filter area/controls
  // 4. On "who did what" → hover over a log entry row
  // 5. On "Click any log" → click a log entry (open detail dialog)
  // 6. Show detail dialog briefly, close it
  // 7. Clear search text
  // 8. End: small-circle focus on search box
  {
    path: "/system-logs",
    target: "[data-testid='input-search-logs']",
    title: "System Logs",
    narration: "System Logs show every action taken in the system with timestamps and descriptions. You can search and filter logs to track who did what and when. Click any log entry for full details.",
  },
  // ── TUT17: tut17.mp3 ────────────────────────────────────────────────
  // ALIVE CURSOR CHOREOGRAPHY:
  // 1. Cursor moves to sidebar, clicks "Help" nav link
  // 2. Full-screen highlight on help page
  // 3. On "frequently asked" → scroll through FAQ list, expand one FAQ
  // 4. On "send feedback" → move cursor to message/feedback section
  // 5. On "That completes" → full-screen celebration highlight
  // 6. End: show completion message/animation
  {
    path: "/help",
    target: "[data-testid='text-help-title']",
    title: "Help & Support",
    narration: "The Help page has frequently asked questions covering all system features. You can also send feedback or messages to administrators if you need additional assistance. That completes the tutorial! You now know all the features of JOAP Hardware Trading system.",
  },
];

const EMPLOYEE_STEPS: TutorialStep[] = [
  {
    path: "/",
    target: "[data-testid='button-sidebar-toggle']",
    title: "Welcome to JOAP Hardware Trading",
    narration: "Welcome to JOAP Hardware Trading! I'll show you how to use the system as an employee. This is the sidebar toggle for navigation.",
  },
  {
    path: "/",
    target: "[data-testid='input-global-search']",
    title: "Global Search",
    narration: "Use this search bar to quickly find items, orders, or customers from anywhere in the system.",
  },
  {
    path: "/",
    target: "[data-testid='card-earnings']",
    title: "Dashboard",
    narration: "Your dashboard shows key business metrics: earnings, orders, customers, and pending balances. Each card can be filtered by time period.",
  },
  {
    path: "/",
    target: "[data-testid='section-revenue']",
    title: "Charts & Voice Insight",
    narration: "You can double-click on any chart or card to get AI-powered voice insights about that data. A voice bubble will appear with the AI analysis.",
  },
  {
    path: "/inventory",
    target: "[data-testid='button-add-item']",
    title: "Inventory Management",
    narration: "Here you manage inventory. You can add items, update quantities, and adjust prices. Note: when you upload an image for an item, it needs admin approval before it appears.",
  },
  {
    path: "/inventory",
    target: "[data-testid='input-search-items']",
    title: "Search Inventory",
    narration: "Search for items by name, filter by category, and switch between grid and list views. Use the actions menu to deduct stock or adjust prices.",
  },
  {
    path: "/orders",
    target: "[data-testid='button-create-order']",
    title: "Creating Orders",
    narration: "Create new orders here. Enter the customer name, add items with quantities, choose the sales channel, and optionally add a delivery address. The system calculates totals automatically.",
  },
  {
    path: "/orders",
    target: "[data-testid='tab-all']",
    title: "Order Status",
    narration: "View orders by status using these tabs. Click any order to see details, log payments, or update the order status as it progresses.",
  },
  {
    path: "/billing",
    target: "[data-testid='button-toggle-search']",
    title: "Billing",
    narration: "The Billing page shows all payments. Click the search button to search by date, order ID, GCash number, or reference number. Click any record to see the full order.",
  },
  {
    path: "/accounting",
    target: "[data-testid='button-add-entry']",
    title: "Accounting",
    narration: "View the Chart of Accounts and General Ledger here. These show all financial records and transactions in the system.",
  },
  {
    path: "/reports",
    target: "[data-testid='tab-sales']",
    title: "Reports",
    narration: "Generate and export sales, inventory, and financial reports filtered by date range.",
  },
  {
    path: "/help",
    target: "[data-testid='text-help-title']",
    title: "Help",
    narration: "Check the FAQs for answers to common questions, or send a message to your admin for help. That's everything you need to know! Enjoy using the system.",
  },
];

interface TutorialProps {
  isAdmin: boolean;
  onComplete: () => void;
}

type StepPhase = "loading" | "playing" | "ready";

function CircularProgress({ progress }: { progress: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle
        cx="20" cy="20" r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-muted-foreground/20"
      />
      <circle
        cx="20" cy="20" r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-primary transition-all duration-300"
        transform="rotate(-90 20 20)"
      />
      <text
        x="20" y="20"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[8px] font-semibold fill-primary"
      >
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

export function Tutorial({ isAdmin, onComplete }: TutorialProps) {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [narrationText, setNarrationText] = useState("");
  const [displayedWords, setDisplayedWords] = useState("");
  const [phase, setPhase] = useState<StepPhase>("loading");
  const [loadProgress, setLoadProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const targetElRef = useRef<HTMLElement | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHighlightRef = useRef<string | null>(null);

  const steps = isAdmin ? ADMIN_STEPS : EMPLOYEE_STEPS;
  const step = steps[currentStep];

  const cleanup = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null; }
    if (loadTimerRef.current) { clearInterval(loadTimerRef.current); loadTimerRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    pendingHighlightRef.current = null;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; cleanup(); };
  }, [cleanup]);

  const showHighlight = useCallback((selector: string, attempt = 0) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    targetElRef.current = el;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (pendingHighlightRef.current !== selector) return;
        const rect = el.getBoundingClientRect();
        setSpotlightRect(rect);
        setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }, 500);
    } else if (attempt < 8) {
      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && pendingHighlightRef.current === selector) {
          showHighlight(selector, attempt + 1);
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
      onComplete();
    }
  }, [currentStep, steps.length, onComplete]);

  const startLoadingAnimation = useCallback(() => {
    setLoadProgress(0);
    let prog = 0;
    loadTimerRef.current = setInterval(() => {
      prog += Math.random() * 8 + 2;
      if (prog > 90) prog = 90;
      if (!isMountedRef.current) return;
      setLoadProgress(prog);
    }, 200);
  }, []);

  const stopLoadingAnimation = useCallback(() => {
    if (loadTimerRef.current) { clearInterval(loadTimerRef.current); loadTimerRef.current = null; }
    setLoadProgress(100);
  }, []);

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  playStep() — THIS IS THE MAIN FUNCTION TO OVERHAUL                    ║
  // ║                                                                        ║
  // ║  CURRENT: Calls POST /api/voice-insight (Gemini TTS API) each step     ║
  // ║  REPLACE WITH: Load local MP3 from /api/tutorial-audio/tut{N}.mp3      ║
  // ║    where N = currentStep + 1 (tut1.mp3 through tut17.mp3)              ║
  // ║                                                                        ║
  // ║  STEP 1: Remove the apiRequest("POST", "/api/voice-insight"...) call   ║
  // ║  STEP 2: Instead, create Audio(`/api/tutorial-audio/tut${N}.mp3`)      ║
  // ║  STEP 3: No loading animation needed — MP3 loads near-instantly        ║
  // ║                                                                        ║
  // ║  PHASE 2 — ALIVE CURSOR:                                               ║
  // ║  After MP3 starts playing, execute the choreography actions array       ║
  // ║  from the step definition. Each action has a triggerTime (seconds)      ║
  // ║  relative to audio start. Use audio.currentTime + setTimeout to        ║
  // ║  schedule cursor movements, clicks, typing, tab switches, etc.         ║
  // ║  See task.txt for the full CursorAction interface spec.                ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const playStep = useCallback(async () => {
    if (!step || !isMountedRef.current) return;
    cleanup();
    setPhase("loading");
    setNarrationText(step.narration);
    setDisplayedWords("");
    setSpotlightRect(null);
    setCursorPos(null);
    startLoadingAnimation();

    navigate(step.path);

    pendingHighlightRef.current = step.target;

    const words = step.narration.split(" ");
    let wordIndex = 0;

    const revealHighlight = () => {
      if (pendingHighlightRef.current === step.target) {
        showHighlight(step.target);
      }
    };

    // TODO: REPLACE THIS ENTIRE TRY BLOCK — remove Gemini TTS API call,
    // use local MP3 instead:
    //   const audio = new Audio(`/api/tutorial-audio/tut${currentStep + 1}.mp3`);
    //   audioRef.current = audio;
    //   await audio.play();
    // Then schedule choreography actions based on audio.currentTime
    try {
      if (!isMuted) {
        const res = await apiRequest("POST", "/api/voice-insight", {
          question: `Narrate this tutorial step naturally: ${step.narration}`,
          clickedPoint: { tutorialStep: currentStep + 1, title: step.title },
        });
        const data = await res.json();
        if (!isMountedRef.current) return;

        stopLoadingAnimation();
        setPhase("playing");
        revealHighlight();

        if (data.data?.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.data.audioBase64}`);
          audioRef.current = audio;

          const audioDuration = await new Promise<number>((resolve) => {
            audio.addEventListener("loadedmetadata", () => resolve(audio.duration), { once: true });
            setTimeout(() => resolve(words.length * 0.35), 3000);
          });

          const msPerWord = Math.max(150, (audioDuration * 1000) / words.length);

          wordTimerRef.current = setInterval(() => {
            if (!isMountedRef.current) return;
            if (wordIndex < words.length) {
              setDisplayedWords(words.slice(0, wordIndex + 1).join(" "));
              wordIndex++;
            } else {
              if (wordTimerRef.current) clearInterval(wordTimerRef.current);
            }
          }, msPerWord);

          audio.onended = () => {
            if (!isMountedRef.current) return;
            setDisplayedWords(step.narration);
            if (wordTimerRef.current) clearInterval(wordTimerRef.current);
            setPhase("ready");
          };

          audio.play().catch(() => {
            if (wordTimerRef.current) clearInterval(wordTimerRef.current);
            setDisplayedWords(step.narration);
            setPhase("ready");
          });
          return;
        }
      }
    } catch {
      if (!isMountedRef.current) return;
    }

    stopLoadingAnimation();
    setPhase("playing");
    revealHighlight();
    const msPerWord = 200;
    wordTimerRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      if (wordIndex < words.length) {
        setDisplayedWords(words.slice(0, wordIndex + 1).join(" "));
        wordIndex++;
      } else {
        if (wordTimerRef.current) clearInterval(wordTimerRef.current);
        setPhase("ready");
      }
    }, msPerWord);
  }, [step, currentStep, isMuted, navigate, showHighlight, cleanup, startLoadingAnimation, stopLoadingAnimation]);

  useEffect(() => {
    playStep();
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
      targetElRef.current.click();
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
              <ellipse
                cx={spotlightRect.left + spotlightRect.width / 2}
                cy={spotlightRect.top + spotlightRect.height / 2}
                rx={Math.max(spotlightRect.width, 60) / 2 + 20}
                ry={Math.max(spotlightRect.height, 40) / 2 + 20}
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
            left: spotlightRect.left - 20,
            top: spotlightRect.top - 20,
            width: spotlightRect.width + 40,
            height: spotlightRect.height + 40,
            zIndex: 10001,
            borderRadius: "50%",
          }}
          onClick={handleSpotlightClick}
          data-testid="tutorial-spotlight-clickable"
        />
      )}

      {showSpotlight && (
        <div
          className="fixed pointer-events-none rounded-full border-2 border-primary animate-pulse"
          style={{
            left: spotlightRect.left - 24,
            top: spotlightRect.top - 24,
            width: spotlightRect.width + 48,
            height: spotlightRect.height + 48,
            zIndex: 10000,
          }}
        />
      )}

      {showSpotlight && cursorPos && (
        <div
          className="fixed pointer-events-none transition-all duration-700 ease-in-out hidden sm:block"
          style={{
            left: cursorPos.x - 12,
            top: cursorPos.y - 4,
            zIndex: 10002,
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
                onClick={() => { cleanup(); onComplete(); }}
                data-testid="button-tutorial-end"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="min-h-[40px] sm:min-h-[48px] flex items-center gap-2 sm:gap-3" data-testid="text-tutorial-narration">
            {phase === "loading" ? (
              <div className="flex items-center gap-2 sm:gap-3 w-full justify-center py-1">
                <CircularProgress progress={loadProgress} />
                <span className="text-xs sm:text-sm text-muted-foreground">Preparing...</span>
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
