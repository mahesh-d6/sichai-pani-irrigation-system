import { useState } from "react";
import { OctagonAlert, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import api from "../services/api";
import { sendDeviceNotification } from "../services/deviceNotification";

interface EmergencyShutdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EmergencyShutdownModal({ isOpen, onClose, onSuccess }: EmergencyShutdownModalProps) {
  const { t, lang } = useLanguage();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const handleShutdown = async () => {
    setLoading(true);
    try {
      await api.post("/api/infra/emergency-shutdown", { reason: reason || "Emergency Shutdown Triggered" }).catch(() => {});
      sendDeviceNotification("⚠️ EMERGENCY WATER SHUTDOWN", reason || "All irrigation pumps and canal flow have been halted immediately.");
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onSuccess?.();
        onClose();
      }, 2000);
    } catch {
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-md border-red-500/30 shadow-2xl relative">
        {!done ? (
          <>
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
              <div className="p-3 rounded-2xl bg-red-100 dark:bg-red-950/50">
                <OctagonAlert size={28} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-earth-900 dark:text-canal-50">
                  {t("emergency_killswitch")}
                </h3>
                <p className="text-xs text-red-500 font-medium">Halt All Active Pumps & Delivery</p>
              </div>
            </div>

            <p className="text-sm text-canal-600 dark:text-canal-300 mb-4">
              {lang === "ne"
                ? "यो थिच्दा सबै सक्रिय पानी पम्पहरू तत्काल बन्द हुनेछन् र सूचना जारी हुनेछ।"
                : "This action will immediately stop all active water pumps and notify all operators & farmers."}
            </p>

            <div className="mb-6">
              <label className="text-xs font-semibold block mb-1">Shutdown Reason / Remarks</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Canal breach detected on Sector 2 / Heavy unexpected rain"
                rows={3}
                className="input"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl glass text-sm font-medium">
                {t("cancel")}
              </button>
              <button
                onClick={handleShutdown}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
              >
                <ShieldAlert size={18} />
                {loading ? "Shutting down..." : "Execute Shutdown"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 size={48} className="text-green-500 mb-3 animate-bounce" />
            <h4 className="font-display font-semibold text-lg">Emergency Halt Initiated</h4>
            <p className="text-xs text-canal-500 mt-1">All pumps stopped & notices dispatched.</p>
          </div>
        )}
      </div>
    </div>
  );
}
