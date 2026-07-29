import { useState } from "react";
import { motion } from "framer-motion";
import { Fingerprint, ShieldCheck, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { enrollDeviceBiometric } from "../services/biometricAuth";

interface EnableBiometricModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  user: any;
  token: string;
}

export default function EnableBiometricModal({ isOpen, onClose, role, user, token }: EnableBiometricModalProps) {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleEnroll = async () => {
    setLoading(true);
    try {
      await enrollDeviceBiometric(role, user, token);
      onClose();
    } catch (e) {
      console.warn("Biometric enrollment error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-strong rounded-3xl p-6 max-w-sm w-full relative shadow-2xl border border-canal-200 dark:border-canal-700"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-canal-400 hover:text-canal-600">
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-canal-600/10 dark:bg-canal-300/10 flex items-center justify-center mb-4 text-canal-600 dark:text-canal-300">
            <Fingerprint size={32} className="animate-pulse" />
          </div>

          <h3 className="font-display text-lg font-bold text-earth-900 dark:text-canal-50 mb-1">
            {lang === "ne" ? "फिंगरप्रिन्ट लगइन सक्षम गर्नुहोस्?" : "Enable Biometric Authentication?"}
          </h3>
          <p className="text-xs text-canal-500 mb-5 leading-relaxed">
            {lang === "ne"
              ? "अर्को पटक पासवर्ड बिना आफ्नो फोनको फिंगरप्रिन्ट वा टच आइडीबाट सिधै १-टच लगइन गर्नुहोस्।"
              : "Use your device's Fingerprint, Face Unlock, or Device PIN to log in instantly with 1 touch next time."}
          </p>

          <div className="flex items-center gap-2 text-[11px] text-paddy-700 dark:text-paddy-300 bg-paddy-50 dark:bg-paddy-950/40 px-3 py-2 rounded-xl mb-5 w-full">
            <ShieldCheck size={14} className="flex-shrink-0" />
            <span>
              {lang === "ne"
                ? "सुरक्षित: तपाईको फिंगरप्रिन्ट डाटा यो फोनमै मात्र रहन्छ।"
                : "Bank-Grade Security: Only an encrypted key is saved on this device."}
            </span>
          </div>

          <div className="flex gap-2 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-canal-300 dark:border-canal-600 text-xs font-semibold text-canal-600 dark:text-canal-300 hover:bg-canal-50 dark:hover:bg-canal-800 transition-colors"
            >
              {lang === "ne" ? "अहिले होइन" : "Not Now"}
            </button>
            <button
              onClick={handleEnroll}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-canal-600 hover:bg-canal-700 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-60"
            >
              {loading ? (lang === "ne" ? "दर्ता गर्दै..." : "Enabling...") : (lang === "ne" ? "सक्षम गर्नुहोस्" : "Enable 1-Touch")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
