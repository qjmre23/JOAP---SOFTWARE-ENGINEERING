import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SettingsProvider } from "@/lib/settings-context";
import { Loader2, LogOut, Search, Package, ShoppingCart, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect, useRef, useCallback } from "react";
import { GeminiFloatingChat } from "@/components/gemini-chat";
import { Tutorial } from "@/components/tutorial";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap, Mail, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import InventoryPage from "@/pages/inventory";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import BillingPage from "@/pages/billing";
import UsersPage from "@/pages/users";
import AccountingPage from "@/pages/accounting";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import AboutPage from "@/pages/about";
import HelpPage from "@/pages/help";
import SystemLogsPage from "@/pages/system-logs";
import MaintenancePage from "@/pages/maintenance";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/orders/:id" component={OrderDetailPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/accounting" component={AccountingPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/help" component={HelpPage} />
      <Route path="/system-logs" component={SystemLogsPage} />
      <Route path="/maintenance" component={MaintenancePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

interface SearchResult {
  type: "item" | "order" | "customer";
  id: string;
  label: string;
  sublabel: string;
}

function GlobalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSource, setSearchSource] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) {
      setResults([]);
      setShowDropdown(false);
      setSearchSource("");
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const endpoint = query.length < 2
          ? `/api/search/autocomplete?q=${encodeURIComponent(query)}`
          : `/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(endpoint, {
          credentials: "include",
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.data?.results || []);
          setSearchSource(data.data?.source || "");
          setShowDropdown(true);
        }
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: SearchResult) {
    setShowDropdown(false);
    setQuery("");
    if (result.type === "item") navigate("/inventory");
    else if (result.type === "order") navigate(`/orders/${result.id}`);
    else if (result.type === "customer") navigate("/orders");
  }

  const typeIcon = (type: string) => {
    if (type === "item") return <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    if (type === "order") return <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    return <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  };

  return (
    <div className="relative" ref={containerRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search..."
        className="pl-9 w-[120px] sm:w-[200px] lg:w-[300px] text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
        data-testid="input-global-search"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-[260px] sm:w-[300px] bg-popover border rounded-md shadow-md z-50 max-h-[320px] overflow-auto">
          {searchSource && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/30">
              <Zap className="h-3 w-3 text-yellow-500" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {searchSource === "trie" ? "Trie prefix search" : searchSource === "hash-index" ? "Hash O(1) lookup" : "Database search"}
              </span>
            </div>
          )}
          {isSearching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No results found</p>
          ) : (
            (() => {
              const grouped: Record<string, SearchResult[]> = {};
              for (const r of results) {
                if (!grouped[r.type]) grouped[r.type] = [];
                grouped[r.type].push(r);
              }
              const typeLabels: Record<string, string> = { item: "Items", order: "Orders", customer: "Customers" };
              return Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="px-3 py-1 bg-muted/40 border-b">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {typeLabels[type] || type} ({items.length})
                    </span>
                  </div>
                  {items.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover-elevate"
                      onClick={() => handleSelect(r)}
                      data-testid={`search-result-${r.type}-${r.id}`}
                    >
                      {typeIcon(r.type)}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{r.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}

function AuthenticatedLayout() {
  const { logout, user, isAdmin } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      fetch("/api/auth/profile", { credentials: "include", headers })
        .then(r => r.json())
        .then(data => {
          if (data.data?.user?.email) {
            setCurrentEmail(data.data.user.email);
            setProfileEmail(data.data.user.email);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleSaveEmail = async () => {
    if (!profileEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setProfileLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/auth/profile/email", {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ email: profileEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentEmail(profileEmail);
        toast({ title: "Email Updated", description: "Your email address has been updated successfully." });
        setShowProfileDialog(false);
      } else {
        toast({ title: "Error", description: data.error || "Failed to update email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const skipKey = `skipTutorial_${user.username}`;
      if (localStorage.getItem(skipKey) !== "true") {
        const timer = setTimeout(() => setShowTutorialPrompt(true), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const handleTutorialNo = useCallback(() => {
    if (dontShowAgain && user) {
      localStorage.setItem(`skipTutorial_${user.username}`, "true");
    }
    setShowTutorialPrompt(false);
  }, [dontShowAgain, user]);

  const handleTutorialYes = useCallback(() => {
    if (dontShowAgain && user) {
      localStorage.setItem(`skipTutorial_${user.username}`, "true");
    }
    setShowTutorialPrompt(false);
    setShowTutorial(true);
  }, [dontShowAgain, user]);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" className="gap-1.5 hidden md:flex" onClick={() => { setProfileEmail(currentEmail); setShowProfileDialog(true); }} data-testid="button-profile">
                <UserIcon className="h-3.5 w-3.5" />
                <span className="text-sm" data-testid="text-header-user">{user?.username}</span>
                {currentEmail && <Mail className="h-3 w-3 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowLogoutDialog(true)} data-testid="button-logout" title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            <Router />
          </main>
        </div>
      </div>

      <GeminiFloatingChat />

      {showTutorial && (
        <Tutorial isAdmin={isAdmin} onComplete={async (savedSettings) => {
          setShowTutorial(false);
          if (savedSettings) {
            try {
              const token = localStorage.getItem("token");
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (token) headers["Authorization"] = `Bearer ${token}`;
              await fetch("/api/settings", {
                method: "PATCH",
                headers,
                credentials: "include",
                body: JSON.stringify({
                  colorTheme: savedSettings.colorTheme,
                  gradient: savedSettings.gradient,
                  font: savedSettings.font,
                }),
              });
              queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
            } catch {}
          }
        }} />
      )}

      <AlertDialog open={showTutorialPrompt} onOpenChange={setShowTutorialPrompt}>
        <AlertDialogContent className="max-w-sm" data-testid="dialog-tutorial-prompt">
          <AlertDialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">Do you want to try the tutorial?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              A guided walkthrough of all system features with voice narration. Takes about 3 minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-1 py-2">
            <Checkbox
              id="dontShowAgain"
              checked={dontShowAgain}
              onCheckedChange={(v) => setDontShowAgain(!!v)}
              data-testid="checkbox-dont-show-tutorial"
            />
            <label htmlFor="dontShowAgain" className="text-sm text-muted-foreground cursor-pointer">
              Don't show again
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleTutorialNo} data-testid="button-tutorial-no">
              No
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleTutorialYes} data-testid="button-tutorial-yes">
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to the login page and will need to sign in again to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-logout-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowLogoutDialog(false); logout(); }}
              data-testid="button-logout-confirm"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>Update your email address for password reset and notifications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Username</Label>
              <p className="text-sm font-medium">{user?.username}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Role</Label>
              <p className="text-sm font-medium">{isAdmin ? "Admin" : "Employee"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email Address</Label>
              <Input
                id="profile-email"
                type="email"
                placeholder="Enter your email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                data-testid="input-profile-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEmail} disabled={profileLoading} data-testid="button-save-email">
              {profileLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <SettingsProvider>
      <AuthenticatedLayout />
    </SettingsProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
