import { useEffect, useState } from "react";
import {
  Users, Droplets, CalendarClock, Wallet, Waves as WavesIcon,
  TrendingUp, AlertCircle, Fuel, MessageSquareWarning, Bell,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../services/api";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

interface Stats {
  total_farmers: number;
  active_water_requests: number;
  todays_schedule: number;
  total_revenue: number;
  water_used_today_hours: number;
  monthly_income: number;
  pending_payments: number;
  active_pumps: number;
  open_complaints: number;
  unread_notifications: number;
}

interface ChartPoint {
  label: string;
  value: number;
}

import WeatherWidget from "../components/WeatherWidget";
import EmergencyShutdownModal from "../components/EmergencyShutdownModal";
import { OctagonAlert } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [waterUsage, setWaterUsage] = useState<ChartPoint[]>([]);
  const [revenue, setRevenue] = useState<ChartPoint[]>([]);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  useEffect(() => {
    api.get("/api/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/api/dashboard/charts/water-usage").then((r) => setWaterUsage(r.data)).catch(() => {});
    api.get("/api/dashboard/charts/revenue").then((r) => setRevenue(r.data)).catch(() => {});
  }, []);

  const currency = "Rs.";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="lg:hidden">
          <p className="text-sm text-canal-600 dark:text-canal-300">{t("welcome_back")}</p>
          <h1 className="font-display text-xl font-semibold">{user?.full_name}</h1>
        </div>

        {(user?.role === "super_admin" || user?.role === "admin" || user?.role === "water_operator") && (
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md transition-colors ml-auto"
          >
            <OctagonAlert size={16} className="animate-pulse" />
            <span>{t("emergency_shutdown")}</span>
          </button>
        )}
      </div>

      {/* Live Weather Forecast & Smart AI Irrigation Advice */}
      <WeatherWidget />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard index={0} label={t("total_farmers")} value={stats ? String(stats.total_farmers) : "…"} icon={Users} accent="canal" />
        <StatCard index={1} label={t("active_requests")} value={stats ? String(stats.active_water_requests) : "…"} icon={Droplets} accent="canal" />
        <StatCard index={2} label={t("todays_schedule")} value={stats ? String(stats.todays_schedule) : "…"} icon={CalendarClock} accent="paddy" />
        <StatCard index={3} label={t("total_revenue")} value={stats ? `${currency}${stats.total_revenue.toLocaleString()}` : "…"} icon={Wallet} accent="paddy" />
        <StatCard index={4} label={t("water_used_today")} value={stats ? `${stats.water_used_today_hours} hrs` : "…"} icon={WavesIcon} accent="canal" />
        <StatCard index={5} label={t("monthly_income")} value={stats ? `${currency}${stats.monthly_income.toLocaleString()}` : "…"} icon={TrendingUp} accent="paddy" />
        <StatCard index={6} label={t("pending_payments")} value={stats ? `${currency}${stats.pending_payments.toLocaleString()}` : "…"} icon={AlertCircle} accent="amber" />
        <StatCard index={7} label={t("active_pumps")} value={stats ? String(stats.active_pumps) : "…"} icon={Fuel} accent="canal" />
        <StatCard index={8} label={t("complaints_label")} value={stats ? String(stats.open_complaints) : "…"} icon={MessageSquareWarning} accent="rose" />
        <StatCard index={9} label={t("notifications_label")} value={stats ? String(stats.unread_notifications) : "…"} icon={Bell} accent="canal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold mb-4">{t("water_usage_chart")}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={waterUsage}>
              <defs>
                <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1f97a3" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#1f97a3" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#1f97a3" fill="url(#waterGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold mb-4">{t("revenue_chart")}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#529f34" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <EmergencyShutdownModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        onSuccess={() => {
          api.get("/api/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
        }}
      />
    </div>
  );
}
