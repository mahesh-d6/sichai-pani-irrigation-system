import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Waves, ShieldCheck, Wrench, Sprout } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

const ROLES = [
  {
    to: "/login/admin",
    icon: ShieldCheck,
    title: "Admin (Adaksha)",
    subtitle: "Approve payments, manage farmers, complaints & reports",
    accent: "bg-canal-600",
  },
  {
    to: "/login/operator",
    icon: Wrench,
    title: "Operator",
    subtitle: "Start and stop water delivery for requests",
    accent: "bg-earth-800",
  },
  {
    to: "/farmer/login",
    icon: Sprout,
    title: "Farmer",
    subtitle: "Request water, file complaints, make payments",
    accent: "bg-paddy-600",
  },
];

export default function RoleSelectLogin() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-ripple p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-canal-300/30 blur-3xl animate-ripple" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-paddy-300/30 blur-3xl animate-ripple" />

      <button
        onClick={() => setLang(lang === "en" ? "ne" : "en")}
        className="absolute top-5 right-5 z-20 glass rounded-full px-3 py-1.5 text-xs font-medium"
      >
        {lang === "en" ? "नेपाली" : "English"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-canal-600 flex items-center justify-center mb-3 shadow-lg">
            <Waves className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-earth-900 dark:text-canal-50">Sichai Pani</h1>
          <p className="text-sm text-canal-600 dark:text-canal-300">Choose how you'd like to sign in</p>
        </div>

        <div className="flex flex-col gap-3">
          {ROLES.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="flex items-center gap-4 rounded-2xl border border-canal-200 dark:border-canal-700 bg-white/60 dark:bg-canal-900/30 p-4 hover:bg-white/90 dark:hover:bg-canal-900/60 transition-colors"
            >
              <div className={`w-11 h-11 rounded-xl ${r.accent} flex items-center justify-center flex-shrink-0`}>
                <r.icon className="text-white" size={20} />
              </div>
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-canal-500">{r.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
