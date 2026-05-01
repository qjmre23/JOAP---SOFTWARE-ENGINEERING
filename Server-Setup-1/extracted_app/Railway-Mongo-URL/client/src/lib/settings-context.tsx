import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ISettings } from "@shared/schema";

const FONT_MAP: Record<string, string> = {
  "Inter": "'Inter', sans-serif",
  "Roboto": "'Roboto', sans-serif",
  "Open Sans": "'Open Sans', sans-serif",
  "Lato": "'Lato', sans-serif",
  "Montserrat": "'Montserrat', sans-serif",
  "Poppins": "'Poppins', sans-serif",
  "Nunito": "'Nunito', sans-serif",
  "Raleway": "'Raleway', sans-serif",
  "Source Sans 3": "'Source Sans 3', sans-serif",
  "PT Sans": "'PT Sans', sans-serif",
};

const COLOR_THEMES: Record<string, { primary: string; primaryForeground: string }> = {
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

export const GRADIENT_OPTIONS: Record<string, { label: string; css: string }> = {
  none: { label: "None", css: "" },
  "blue-purple": { label: "Blue to Purple", css: "linear-gradient(135deg, #2563eb, #9333ea)" },
  "emerald-teal": { label: "Emerald to Teal", css: "linear-gradient(135deg, #059669, #0d9488)" },
  "rose-orange": { label: "Rose to Orange", css: "linear-gradient(135deg, #e11d48, #ea580c)" },
  "indigo-blue": { label: "Indigo to Blue", css: "linear-gradient(135deg, #4f46e5, #2563eb)" },
  "purple-pink": { label: "Purple to Pink", css: "linear-gradient(135deg, #9333ea, #ec4899)" },
  "teal-cyan": { label: "Teal to Cyan", css: "linear-gradient(135deg, #0d9488, #06b6d4)" },
  "orange-amber": { label: "Orange to Amber", css: "linear-gradient(135deg, #ea580c, #d97706)" },
  "slate-gray": { label: "Slate to Gray", css: "linear-gradient(135deg, #475569, #6b7280)" },
  "green-emerald": { label: "Green to Emerald", css: "linear-gradient(135deg, #16a34a, #059669)" },
  "red-rose": { label: "Red to Rose", css: "linear-gradient(135deg, #dc2626, #e11d48)" },
};

interface SettingsContextValue {
  settings: ISettings | null;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  isLoading: true,
});

export function useSettings() {
  return useContext(SettingsContext);
}

function loadGoogleFont(fontName: string) {
  if (fontName === "Inter") return;
  const id = `google-font-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: settingsData, isLoading } = useQuery<{ success: boolean; data: ISettings }>({
    queryKey: ["/api/settings"],
    staleTime: 60000,
  });

  const settings = settingsData?.data ?? null;

  useEffect(() => {
    if (!settings) return;

    const font = settings.font || "Inter";
    if (font !== "Inter") {
      loadGoogleFont(font);
    }
    const fontFamily = FONT_MAP[font] || FONT_MAP["Inter"];
    document.body.style.fontFamily = fontFamily;

    const root = document.documentElement;

    const isDark = settings.theme === "dark";
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const colorTheme = COLOR_THEMES[settings.colorTheme] || COLOR_THEMES["blue"];
    root.style.setProperty("--primary", colorTheme.primary);
    root.style.setProperty("--primary-foreground", colorTheme.primaryForeground);

    const gradientKey = settings.gradient || "none";
    const gradient = GRADIENT_OPTIONS[gradientKey];
    if (gradient && gradient.css) {
      root.style.setProperty("--sidebar-gradient", gradient.css);
    } else {
      root.style.removeProperty("--sidebar-gradient");
    }

    return () => {
      document.body.style.fontFamily = "";
      root.classList.remove("dark");
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--sidebar-gradient");
    };
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}
