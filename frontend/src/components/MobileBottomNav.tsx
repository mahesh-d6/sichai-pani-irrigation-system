import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Droplets, CreditCard, MessageSquareWarning, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import type { TranslationKey } from "../i18n/translations";

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; end?: boolean; roles?: string[]; badgeKey?: "requests" | "payments" | "complaints" }[] = [
  { to: "/", labelKey: "nav_dashboard", icon: LayoutDashboard, end: true },
  { to: "/requests", labelKey: "nav_requests", icon: Droplets, badgeKey: "requests" },
  { to: "/payments", labelKey: "nav_payments", icon: CreditCard, roles: ["super_admin", "admin", "farmer"], badgeKey: "payments" },
  { to: "/farmers", labelKey: "nav_farmers", icon: Users, roles: ["super_admin", "admin"] },
  { to: "/complaints", labelKey: "nav_complaints", icon: MessageSquareWarning, roles: ["super_admin", "admin", "farmer"], badgeKey: "complaints" },
  { to: "/settings", labelKey: "nav_settings", icon: Settings },
];

export default function MobileBottomNav({ badgeCounts }: { badgeCounts?: { requests: number; payments: number; complaints: number } }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role))).slice(0, 5);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-canal-200/50 dark:border-canal-700/50 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {visibleItems.map(({ to, labelKey, icon: Icon, end, badgeKey }) => {
        const count = (badgeKey && badgeCounts) ? badgeCounts[badgeKey] : 0;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition-colors relative ${
                isActive
                  ? "text-canal-600 dark:text-canal-300 font-bold"
                  : "text-canal-500 dark:text-canal-400 hover:text-earth-900 dark:hover:text-canal-100"
              }`
            }
          >
            <div className="relative">
              <Icon size={18} />
              {/* 🔴 Red Dot Badge for Mobile */}
              {count > 0 && (
                <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </div>
            <span className="truncate max-w-[64px] text-center">{t(labelKey)}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
