import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Droplets, CreditCard, MessageSquareWarning,
  FileBarChart, Settings, Moon, Sun, LogOut, Waves, Menu, X, Languages,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import type { TranslationKey } from "../i18n/translations";
import NotificationBell from "./NotificationBell";

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; end?: boolean; roles?: string[] }[] = [
  { to: "/", labelKey: "nav_dashboard", icon: LayoutDashboard, end: true },
  { to: "/farmers", labelKey: "nav_farmers", icon: Users, roles: ["super_admin", "admin"] },
  { to: "/requests", labelKey: "nav_requests", icon: Droplets },
  { to: "/payments", labelKey: "nav_payments", icon: CreditCard, roles: ["super_admin", "admin", "farmer"] },
  { to: "/complaints", labelKey: "nav_complaints", icon: MessageSquareWarning, roles: ["super_admin", "admin", "farmer"] },
  { to: "/reports", labelKey: "nav_reports", icon: FileBarChart, roles: ["super_admin", "admin"] },
  { to: "/settings", labelKey: "nav_settings", icon: Settings },
];

import AnnouncementMarquee from "./AnnouncementMarquee";
import MobileBottomNav from "./MobileBottomNav";
import { requestNotificationPermission } from "../services/deviceNotification";

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("sichai_theme") === "dark");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("sichai_theme", dark ? "dark" : "light");
    requestNotificationPermission();
  }, [dark]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-ripple bg-fixed pb-16 lg:pb-0">
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between p-4 glass sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Waves className="text-canal-600 dark:text-canal-300" size={24} />
          <span className="font-display font-semibold text-lg">{t("app_name")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "en" ? "ne" : "en")}
            className="px-2 py-1 glass rounded-lg text-xs font-semibold"
          >
            {lang === "en" ? "नेपाली" : "English"}
          </button>
          <NotificationBell />
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600"
            title={t("logout")}
          >
            <LogOut size={18} />
          </button>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg glass">
            <Menu size={20} />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 glass-strong m-4 rounded-2xl p-5">
          <SidebarContent onNavigate={() => {}} dark={dark} setDark={setDark} onLogout={handleLogout} />
        </aside>

        {/* Sidebar - mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25 }}
                className="fixed top-0 left-0 h-screen w-72 glass-strong z-50 p-5 lg:hidden"
              >
                <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1">
                  <X size={20} />
                </button>
                <SidebarContent onNavigate={() => setMobileOpen(false)} dark={dark} setDark={setDark} onLogout={handleLogout} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 min-w-0 overflow-x-hidden">
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-canal-600 dark:text-canal-300">{t("welcome_back")}</p>
              <h1 className="font-display text-2xl font-semibold">{user?.full_name}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLang(lang === "en" ? "ne" : "en")}
                className="glass hover:bg-white/90 rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Languages size={14} />
                {lang === "en" ? "नेपाली" : "English"}
              </button>
              <NotificationBell />
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-paddy-100 text-paddy-800 dark:bg-paddy-900 dark:text-paddy-200 capitalize">
                {user?.role.replace("_", " ")}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 transition-colors"
                title={t("logout")}
              >
                <LogOut size={14} />
                <span>{t("logout")}</span>
              </button>
            </div>
          </div>

          {/* Marquee Ticker */}
          <AnnouncementMarquee />

          <Outlet />
        </main>
      </div>

      {/* Touch-optimized Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}

function SidebarContent({
  onNavigate, dark, setDark, onLogout,
}: { onNavigate: () => void; dark: boolean; setDark: (v: boolean) => void; onLogout: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const { user } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-8 px-1">
        <Waves className="text-canal-600 dark:text-canal-300" size={26} />
        <div>
          <p className="font-display font-semibold text-lg leading-tight">{t("app_name")}</p>
          <p className="text-[11px] text-canal-500 dark:text-canal-400 leading-tight">{t("app_tagline")}</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {visibleItems.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-canal-600 text-white shadow-md"
                  : "text-earth-800 dark:text-canal-100 hover:bg-canal-100/70 dark:hover:bg-canal-800/50"
              }`
            }
          >
            <Icon size={18} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-2 pt-4 border-t border-canal-200/50 dark:border-canal-700/50">
        <button
          onClick={() => setLang(lang === "en" ? "ne" : "en")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-canal-100/70 dark:hover:bg-canal-800/50"
        >
          <Languages size={18} />
          {lang === "en" ? "नेपाली" : "English"}
        </button>
        <button
          onClick={() => setDark(!dark)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-canal-100/70 dark:hover:bg-canal-800/50"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {dark ? t("light_mode") : t("dark_mode")}
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          <LogOut size={18} />
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
