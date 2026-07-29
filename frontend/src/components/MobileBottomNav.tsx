import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Droplets, CreditCard, MessageSquareWarning, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import type { TranslationKey } from "../i18n/translations";

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; end?: boolean; roles?: string[] }[] = [
  { to: "/", labelKey: "nav_dashboard", icon: LayoutDashboard, end: true },
  { to: "/requests", labelKey: "nav_requests", icon: Droplets },
  { to: "/payments", labelKey: "nav_payments", icon: CreditCard, roles: ["super_admin", "admin", "farmer"] },
  { to: "/farmers", labelKey: "nav_farmers", icon: Users, roles: ["super_admin", "admin"] },
  { to: "/complaints", labelKey: "nav_complaints", icon: MessageSquareWarning, roles: ["super_admin", "admin", "farmer"] },
  { to: "/settings", labelKey: "nav_settings", icon: Settings },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role))).slice(0, 5);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-canal-200/50 dark:border-canal-700/50 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {visibleItems.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition-colors ${
              isActive
                ? "text-canal-600 dark:text-canal-300 font-bold"
                : "text-canal-500 dark:text-canal-400 hover:text-earth-900 dark:hover:text-canal-100"
            }`
          }
        >
          <Icon size={18} />
          <span className="truncate max-w-[64px] text-center">{t(labelKey)}</span>
        </NavLink>
      ))}
    </div>
  );
}
