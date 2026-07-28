import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "canal" | "paddy" | "amber" | "rose";
  index?: number;
}

const ACCENTS: Record<string, string> = {
  canal: "bg-canal-100 text-canal-700 dark:bg-canal-800/60 dark:text-canal-200",
  paddy: "bg-paddy-100 text-paddy-700 dark:bg-paddy-900/60 dark:text-paddy-200",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
};

export default function StatCard({ label, value, icon: Icon, accent = "canal", index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="glass rounded-2xl p-4 flex items-center gap-4"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ACCENTS[accent]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-canal-600 dark:text-canal-300 truncate">{label}</p>
        <p className="font-display text-xl font-semibold truncate">{value}</p>
      </div>
    </motion.div>
  );
}
