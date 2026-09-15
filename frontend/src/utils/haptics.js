import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

// No-op on web — only native Android/iOS builds have anything to vibrate.
const impact = (style) => {
  if (!Capacitor.isNativePlatform()) return;
  Haptics.impact({ style }).catch(() => {});
};

export const hapticLight = () => impact(ImpactStyle.Light);
export const hapticMedium = () => impact(ImpactStyle.Medium);
