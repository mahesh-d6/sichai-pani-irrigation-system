import { useEffect, useState } from "react";
import { Smartphone, Download, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function InstallAppBanner() {
  const { lang } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback message explaining how to add to home screen manually
      alert(
        lang === "ne"
          ? "मोबाइलमा एप थप्न आफ्नो ब्राउजरको मेनु (Three Dots / Share) मा थिचि 'Add to Home Screen' छान्नुहोस्।"
          : "To install: open your browser menu (⋮ or Share) and tap 'Add to Home Screen'."
      );
      return;
    }

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (!showBanner) {
    return (
      <button
        onClick={handleInstallClick}
        className="glass hover:bg-canal-600 hover:text-white transition-colors rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
        title="Install Mobile App"
      >
        <Smartphone size={14} className="text-canal-600 dark:text-canal-300 group-hover:text-white" />
        <span>{lang === "ne" ? "एप डाउनलोड" : "Install App"}</span>
      </button>
    );
  }

  return (
    <div className="w-full glass-strong rounded-2xl p-3 mb-4 flex items-center justify-between gap-3 border-paddy-300 dark:border-paddy-700 shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-paddy-600 text-white flex-shrink-0">
          <Smartphone size={20} />
        </div>
        <div>
          <h4 className="font-display font-bold text-xs text-earth-900 dark:text-canal-50">
            {lang === "ne" ? "सिँचाइ पानी मोबाइल एप" : "Sichai Pani Mobile App"}
          </h4>
          <p className="text-[11px] text-canal-500">
            {lang === "ne" ? "आफ्नो फोनमा होम स्क्रिनमा सिधै प्रयोग गर्नुहोस्" : "Install on your phone for instant access"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-paddy-600 hover:bg-paddy-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
        >
          <Download size={14} />
          <span>{lang === "ne" ? "इन्स्टल" : "Install"}</span>
        </button>
        <button onClick={() => setShowBanner(false)} className="p-1 rounded-lg hover:bg-canal-100 dark:hover:bg-canal-800 text-canal-400">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
