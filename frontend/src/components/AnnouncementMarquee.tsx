import { useEffect, useState } from "react";
import { Megaphone, Edit3, Plus, Trash2, X, Sparkles } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

interface AnnouncementItem {
  id: number;
  text_en: string;
  text_ne: string;
}

export default function AnnouncementMarquee() {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const [dbAnnouncements, setDbAnnouncements] = useState<AnnouncementItem[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newEn, setNewEn] = useState("");
  const [newNe, setNewNe] = useState("");
  const [adding, setAdding] = useState(false);
  const [translating, setTranslating] = useState(false);

  const isStaff = user?.role === "super_admin" || user?.role === "admin" || user?.role === "water_operator";

  const fetchAnnouncements = () => {
    api
      .get("/api/announcements")
      .then((res) => {
        if (Array.isArray(res.data)) {
          setDbAnnouncements(res.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const defaultAnnouncements =
    lang === "ne"
      ? [
          "📢 सूचना: उत्तर नहरमा पानी आपूर्ति नियमित सञ्चालनमा छ ।",
          "💧 जल दर: रु. २०० प्रति घण्टा | समयमै भुक्तानी गरी जरिवानाबाट बच्नुहोस्।",
          "⚠️ सेक्टर ४ मा भोलि मर्मत सम्भार हुने हुँदा सिँचाइ सेवा बिहान ९ देखि १२ सम्म स्थगन रहनेछ।",
        ]
      : [
          "📢 System Notice: Main Canal North water supply is running normally.",
          "💧 Water Rate: Rs. 200 / hour | Pay pending bills on time to avoid disruption.",
          "⚠️ Scheduled maintenance on Sector 4 tomorrow from 9 AM to 12 PM.",
        ];

  const announcements =
    dbAnnouncements.length > 0
      ? dbAnnouncements.map((a) => (lang === "ne" ? a.text_ne : a.text_en))
      : defaultAnnouncements;

  // Auto Translate EN -> NE or NE -> EN
  const autoTranslate = async (sourceText: string, from: "en" | "ne") => {
    if (!sourceText.trim()) return;
    setTranslating(true);
    try {
      const pair = from === "en" ? "en|ne" : "ne|en";
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(sourceText)}&langpair=${pair}`);
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (translated) {
        if (from === "en") setNewNe(translated);
        else setNewEn(translated);
      }
    } catch {
      // ignore
    } finally {
      setTranslating(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEn.trim() || !newNe.trim()) return;
    setAdding(true);
    try {
      await api.post("/api/announcements", { text_en: newEn.trim(), text_ne: newNe.trim() });
      setNewEn("");
      setNewNe("");
      fetchAnnouncements();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/announcements/${id}`);
      fetchAnnouncements();
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className="w-full glass-strong rounded-2xl p-2.5 mb-6 overflow-hidden flex items-center gap-3 border-canal-300 dark:border-canal-700 shadow-sm relative group">
        <div className="flex items-center gap-1.5 bg-canal-600 text-white px-2.5 py-1 rounded-xl text-xs font-semibold flex-shrink-0 shadow-sm">
          <Megaphone size={14} className="animate-bounce" />
          <span>{t("system_announcements")}</span>
        </div>

        <div className="overflow-hidden relative w-full flex-1">
          <div className="animate-marquee whitespace-nowrap flex gap-12 text-xs font-medium text-earth-800 dark:text-canal-100">
            {announcements.map((text, idx) => (
              <span key={idx} className="flex items-center gap-2">
                {text}
              </span>
            ))}
            {/* Duplicate for seamless infinite loop */}
            {announcements.map((text, idx) => (
              <span key={`dup-${idx}`} className="flex items-center gap-2">
                {text}
              </span>
            ))}
          </div>
        </div>

        {isStaff && (
          <button
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-1 bg-white/80 dark:bg-canal-900/80 hover:bg-canal-100 text-canal-700 dark:text-canal-200 border border-canal-300 dark:border-canal-700 px-2.5 py-1 rounded-xl text-xs font-semibold flex-shrink-0 shadow-sm transition-colors"
            title="Edit Announcements"
          >
            <Edit3 size={13} />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Edit Announcements Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-strong rounded-3xl p-6 w-full max-w-lg border-canal-300 dark:border-canal-700 shadow-2xl relative">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-canal-100 dark:hover:bg-canal-800"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4 text-canal-700 dark:text-canal-300">
              <Megaphone size={22} />
              <h3 className="font-display text-xl font-bold text-earth-900 dark:text-canal-50">
                Manage Live Announcements
              </h3>
            </div>

            <form onSubmit={handleAdd} className="space-y-3 mb-6 bg-white/50 dark:bg-canal-900/40 p-4 rounded-2xl border border-canal-200 dark:border-canal-700">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-canal-600 dark:text-canal-300">Add New Marquee Announcement</p>
                {translating && (
                  <span className="text-[10px] text-canal-500 flex items-center gap-1 font-medium animate-pulse">
                    <Sparkles size={12} className="text-amber-500" /> Auto Translating...
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-canal-500 font-medium">English Announcement</label>
                  <button
                    type="button"
                    onClick={() => autoTranslate(newEn, "en")}
                    className="text-[10px] text-canal-600 hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={10} /> Auto-Translate to Nepali
                  </button>
                </div>
                <input
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  onBlur={() => {
                    if (newEn && !newNe) autoTranslate(newEn, "en");
                  }}
                  placeholder="e.g. 📢 Canal 2 repair finished. Water delivery resumed."
                  className="input text-xs"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-canal-500 font-medium">Nepali Announcement (नेपाली सूचना)</label>
                  <button
                    type="button"
                    onClick={() => autoTranslate(newNe, "ne")}
                    className="text-[10px] text-canal-600 hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={10} /> Auto-Translate to English
                  </button>
                </div>
                <input
                  value={newNe}
                  onChange={(e) => setNewNe(e.target.value)}
                  onBlur={() => {
                    if (newNe && !newEn) autoTranslate(newNe, "ne");
                  }}
                  placeholder="उदा. 📢 नहर २ मर्मत सम्पन्न। पानी वितरण पुन: सुरु।"
                  className="input text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={adding}
                className="w-full py-2 bg-canal-600 hover:bg-canal-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
              >
                <Plus size={14} />
                {adding ? "Adding..." : "Add Live Announcement"}
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-canal-600 dark:text-canal-300 mb-2">Active Announcements</p>
              {dbAnnouncements.length === 0 ? (
                <p className="text-xs text-canal-400 italic">Using default system notices. Add custom notices above!</p>
              ) : (
                dbAnnouncements.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/70 dark:bg-canal-900/60 border border-canal-200 dark:border-canal-700 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="font-medium text-earth-900 dark:text-canal-50 truncate">{item.text_en}</p>
                      <p className="text-[11px] text-canal-500 truncate">{item.text_ne}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex-shrink-0"
                      title="Delete announcement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 glass rounded-xl text-xs font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
