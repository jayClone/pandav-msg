import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// Matches each theme's header/bg-secondary color so the status bar reads as
// part of the app chrome instead of the default black/white system bar.
const STATUS_BAR_COLORS = {
  dark: "#1f2937",
  light: "#f8fafc",
};

// Style.Dark = light icons/text (for a dark bar), Style.Light = dark
// icons/text (for a light bar) — named after the bar's own appearance, not
// the app theme, so this reads backwards at a glance.
export const syncStatusBar = async (themeName) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: themeName === "dark" ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLORS[themeName] || STATUS_BAR_COLORS.dark });
  } catch {
    // Best-effort theming only — never worth crashing app start over.
  }
};
