import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Download, X, Sparkles } from 'lucide-react';

// This app isn't distributed through the Play Store, so there's no
// automatic update mechanism — without this, every new build would mean
// manually telling each tester to grab a fresh APK. Instead, the native
// app's own build number is compared against a small version.json served
// alongside the APK download; a newer version prompts to update in place.
const VERSION_CHECK_URL = `${import.meta.env.VITE_API_URL || ''}/downloads/version.json`;

export default function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        const info = await CapacitorApp.getInfo();
        const currentBuild = parseInt(info.build, 10) || 0;

        const res = await fetch(VERSION_CHECK_URL, { cache: 'no-store' });
        if (!res.ok) return;
        const latest = await res.json();

        if (latest.versionCode > currentBuild) {
          setUpdateInfo(latest);
        }
      } catch {
        // Best-effort only — never block app usage over a failed check.
      }
    })();
  }, []);

  if (!updateInfo || dismissed) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl border border-[rgb(var(--border-secondary))] max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="px-6 py-6 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">Update available</h2>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            {updateInfo.notes || `Version ${updateInfo.versionName} is ready to install.`}
          </p>

          <div className="w-full flex flex-col gap-2 mt-2">
            <a
              href={updateInfo.url}
              className="w-full px-4 py-2.5 rounded-lg bg-linear-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white font-semibold text-sm transition-all shadow-lg glow-green flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Update
            </a>
            <button
              onClick={() => setDismissed(true)}
              className="w-full px-4 py-2 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-400 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
