import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, CheckCheck } from "lucide-react";
import api from "../services/api";
import { requestNotificationPermission, sendDeviceNotification } from "../services/deviceNotification";

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastKnownIdRef = useRef<number>(0);

  const load = () => {
    api.get("/api/notifications").then((r) => {
      if (Array.isArray(r.data)) {
        const fetched: Notification[] = r.data;
        if (lastKnownIdRef.current > 0) {
          const newest = fetched.filter((n) => n.id > lastKnownIdRef.current && !n.is_read);
          newest.forEach((n) => {
            sendDeviceNotification(`Sichai Pani: ${n.title}`, n.message);
          });
        }
        if (fetched.length > 0) {
          lastKnownIdRef.current = Math.max(...fetched.map((n) => n.id));
        }
        setItems(fetched);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    requestNotificationPermission();
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markOneRead = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    api.patch(`/api/notifications/${id}/read`).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    api.post("/api/notifications/mark-all-read").catch(() => {});
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl hover:bg-canal-100/60 dark:hover:bg-canal-800/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 glass-strong rounded-2xl shadow-2xl z-50 overflow-hidden max-w-[calc(100vw-32px)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-canal-200/50 dark:border-canal-700/50">
              <p className="font-medium text-sm">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-canal-600 hover:text-canal-800">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="text-sm text-canal-500 text-center py-8">You're all caught up.</p>
              )}
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-canal-100/50 dark:border-canal-800/50 last:border-0 ${!n.is_read ? "bg-canal-50/60 dark:bg-canal-800/30" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    {!n.is_read && (
                      <button onClick={() => markOneRead(n.id)} className="text-canal-400 hover:text-canal-700 flex-shrink-0" title="Mark read">
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-canal-500 mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-canal-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
