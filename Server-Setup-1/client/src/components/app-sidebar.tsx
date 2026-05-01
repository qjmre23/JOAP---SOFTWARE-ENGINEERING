import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  BookOpen,
  BarChart3,
  Users,
  Settings,
  Wrench,
  ScrollText,
  HelpCircle,
  Info,
  Hammer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useSettings, GRADIENT_OPTIONS } from "@/lib/settings-context";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Billing", url: "/billing", icon: CreditCard },
  { title: "Accounting", url: "/accounting", icon: BookOpen },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const adminNavItems = [
  { title: "Users", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "System Logs", url: "/system-logs", icon: ScrollText },
];

const bottomNavItems = [
  { title: "Help", url: "/help", icon: HelpCircle },
  { title: "About", url: "/about", icon: Info },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { isAdmin, user } = useAuth();
  const { settings } = useSettings();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const gradientKey = settings?.gradient || "none";
  const gradient = GRADIENT_OPTIONS[gradientKey];
  const hasGradient = gradient && gradient.css;

  useEffect(() => {
    const sidebarInner = document.querySelector('[data-sidebar="sidebar"]');
    if (!sidebarInner) return;
    if (hasGradient) {
      sidebarInner.classList.add("sidebar-gradient");
    } else {
      sidebarInner.classList.remove("sidebar-gradient");
    }
    return () => {
      sidebarInner.classList.remove("sidebar-gradient");
    };
  }, [hasGradient]);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex items-center justify-center rounded-md bg-primary p-1.5">
            <Hammer className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" data-testid="text-brand-name">JOAP Hardware Trading</span>
            <span className="text-xs text-muted-foreground">Supplier Management</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          {bottomNavItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        {user && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Logged in as <span className="font-medium text-foreground" data-testid="text-current-user">{user.username}</span>
            <Badge variant="outline" className="ml-1 text-[10px]">{user.role}</Badge>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
