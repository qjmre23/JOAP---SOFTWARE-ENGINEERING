import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings, Loader2, Save, Type, Palette, Layers } from "lucide-react";
import { settingsSchema, type SettingsInput, type ISettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GRADIENT_OPTIONS } from "@/lib/settings-context";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const FONT_OPTIONS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Raleway",
  "Source Sans 3",
  "PT Sans",
];

const COLOR_THEME_OPTIONS = [
  { value: "blue", label: "Blue", color: "#2563eb" },
  { value: "emerald", label: "Emerald", color: "#059669" },
  { value: "purple", label: "Purple", color: "#9333ea" },
  { value: "rose", label: "Rose", color: "#e11d48" },
  { value: "orange", label: "Orange", color: "#ea580c" },
  { value: "teal", label: "Teal", color: "#0d9488" },
  { value: "indigo", label: "Indigo", color: "#4f46e5" },
  { value: "amber", label: "Amber", color: "#d97706" },
  { value: "cyan", label: "Cyan", color: "#06b6d4" },
  { value: "slate", label: "Slate", color: "#475569" },
];

const GRADIENT_SWATCHES: Record<string, string> = {
  none: "transparent",
  "blue-purple": "linear-gradient(135deg, #2563eb, #9333ea)",
  "emerald-teal": "linear-gradient(135deg, #059669, #0d9488)",
  "rose-orange": "linear-gradient(135deg, #e11d48, #ea580c)",
  "indigo-blue": "linear-gradient(135deg, #4f46e5, #2563eb)",
  "purple-pink": "linear-gradient(135deg, #9333ea, #ec4899)",
  "teal-cyan": "linear-gradient(135deg, #0d9488, #06b6d4)",
  "orange-amber": "linear-gradient(135deg, #ea580c, #d97706)",
  "slate-gray": "linear-gradient(135deg, #475569, #6b7280)",
  "green-emerald": "linear-gradient(135deg, #16a34a, #059669)",
  "red-rose": "linear-gradient(135deg, #dc2626, #e11d48)",
};

function loadGoogleFontPreview(fontName: string) {
  if (fontName === "Inter") return;
  const id = `google-font-preview-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500&display=swap`;
  document.head.appendChild(link);
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const { data: settingsData, isLoading } = useQuery<{ success: boolean; data: ISettings }>({
    queryKey: ["/api/settings"],
  });

  const settings = settingsData?.data as ISettings | undefined;

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: settings?.companyName || "JOAP Hardware Trading",
      theme: (settings?.theme as "light" | "dark") || "light",
      reorderThreshold: settings?.reorderThreshold || 10,
      lowStockThreshold: settings?.lowStockThreshold || 5,
      font: settings?.font || "Inter",
      colorTheme: settings?.colorTheme || "blue",
      gradient: settings?.gradient || "none",
    },
    values: settings ? {
      companyName: settings.companyName,
      theme: settings.theme as "light" | "dark",
      reorderThreshold: settings.reorderThreshold,
      lowStockThreshold: settings.lowStockThreshold,
      font: settings.font || "Inter",
      colorTheme: settings.colorTheme || "blue",
      gradient: settings.gradient || "none",
    } : undefined,
  });

  useEffect(() => {
    FONT_OPTIONS.forEach(loadGoogleFontPreview);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: SettingsInput) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to save settings", description: err.message, variant: "destructive" }),
  });

  const selectedFont = form.watch("font");
  const selectedColorTheme = form.watch("colorTheme");
  const selectedGradient = form.watch("gradient");

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
        <h1 className="text-2xl font-bold">Settings</h1>
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-settings-title">Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" /> System Settings
              </CardTitle>
              <CardDescription>Configure system-wide settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-company-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="theme" render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-theme"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorderThreshold" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Threshold</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-reorder-threshold" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                <FormItem>
                  <FormLabel>Low Stock Threshold</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-low-stock-threshold" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-4 w-4" /> Font Selection
              </CardTitle>
              <CardDescription>Choose a font for the entire application</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="font" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font}
                        type="button"
                        onClick={() => field.onChange(font)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-md border text-sm transition-colors",
                          selectedFont === font
                            ? "border-primary bg-primary/10"
                            : "border-border hover-elevate"
                        )}
                        style={{ fontFamily: `'${font}', sans-serif` }}
                        data-testid={`font-option-${font.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <span className="font-medium text-base">Aa</span>
                        <span className="text-xs text-muted-foreground mt-1">{font}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" /> Color Theme
              </CardTitle>
              <CardDescription>Select the primary color theme for the application</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="colorTheme" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {COLOR_THEME_OPTIONS.map((theme) => (
                      <button
                        key={theme.value}
                        type="button"
                        onClick={() => field.onChange(theme.value)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-md border text-sm transition-colors",
                          selectedColorTheme === theme.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover-elevate"
                        )}
                        data-testid={`color-theme-option-${theme.value}`}
                      >
                        <div
                          className="h-5 w-5 rounded-full shrink-0"
                          style={{ backgroundColor: theme.color }}
                        />
                        <span className="text-sm">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" /> Gradient Background
              </CardTitle>
              <CardDescription>Choose a gradient for the sidebar background</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="gradient" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {Object.entries(GRADIENT_OPTIONS).map(([key, opt]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => field.onChange(key)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-md border text-sm transition-colors",
                          selectedGradient === key
                            ? "border-primary bg-primary/10"
                            : "border-border hover-elevate"
                        )}
                        data-testid={`gradient-option-${key}`}
                      >
                        <div
                          className="h-8 w-full rounded-md"
                          style={{
                            background: key === "none"
                              ? "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px"
                              : GRADIENT_SWATCHES[key],
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-settings">
            {saveMutation.isPending ? <Loader2 className="animate-spin mr-1" /> : <Save className="mr-1" />}
            Save Settings
          </Button>
        </form>
      </Form>
    </div>
  );
}
