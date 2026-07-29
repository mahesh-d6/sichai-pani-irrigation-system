import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Waves, ShieldCheck, Wrench, Sprout, LogOut } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import type { TranslationKey } from "../i18n/translations";

const ROLES: { to: string; icon: typeof ShieldCheck; titleKey: TranslationKey; subtitleKey: TranslationKey; accent: string }[] = [
  {
    to: "/login/admin",
    icon: ShieldCheck,
    titleKey: "admin_role_title",
    subtitleKey: "admin_role_subtitle",
    accent: "bg-canal-600",
  },
  {
    to: "/login/operator",
    icon: Wrench,
    titleKey: "operator_role_title",
    subtitleKey: "operator_role_subtitle",
    accent: "bg-earth-800",
  },
  {
    to: "/farmer/login",
    icon: Sprout,
    titleKey: "farmer_role_title",
    subtitleKey: "farmer_role_subtitle",
    accent: "bg-paddy-600",
  },
];

export default function RoleSelectLogin() {
  const { lang, setLang, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-ripple p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-canal-300/30 blur-3xl animate-ripple" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-paddy-300/30 blur-3xl animate-ripple" />

      <button
        onClick={() => setLang(lang === "en" ? "ne" : "en")}
        className="absolute top-5 right-5 z-20 glass rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-white/90 transition-colors shadow-sm"
      >
        {lang === "en" ? "नेपाली" : "English"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10 shadow-xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-canal-600 flex items-center justify-center mb-3 shadow-lg">
            <Waves className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-earth-900 dark:text-canal-50">{t("app_name")}</h1>
          <p className="text-sm text-canal-600 dark:text-canal-300">{t("choose_signin_mode")}</p>
        </div>

        {user && (
          <div className="mb-6 p-3 rounded-2xl bg-canal-50 dark:bg-canal-900/50 border border-canal-200 dark:border-canal-700 flex items-center justify-between">
            <div className="text-xs">
              <p className="text-canal-500">{t("welcome_back")}</p>
              <p className="font-semibold text-earth-900 dark:text-canal-50">{user.full_name}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 text-xs font-semibold hover:bg-red-200 transition-colors"
            >
              <LogOut size={14} />
              <span>{t("logout")}</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {ROLES.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="flex items-center gap-4 rounded-2xl border border-canal-200 dark:border-canal-700 bg-white/60 dark:bg-canal-900/30 p-4 hover:bg-white/90 dark:hover:bg-canal-900/60 transition-all shadow-sm"
            >
              <div className={`w-11 h-11 rounded-xl ${r.accent} flex items-center justify-center flex-shrink-0`}>
                <r.icon className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-earth-900 dark:text-canal-50">{t(r.titleKey)}</p>
                <p className="text-xs text-canal-500 dark:text-canal-400 truncate-slide">{t(r.subtitleKey)}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
