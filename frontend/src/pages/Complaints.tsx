import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Plus, X, MessageSquareWarning, AlertCircle } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

interface Complaint {
  id: number;
  farmer_id: number;
  category: string;
  title?: string;
  description?: string;
  status: string;
  admin_reply?: string;
  created_at: string;
}

const CATEGORIES = ["Leakage", "No Water", "Late Supply", "Broken Canal", "Other Issues"];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
  in_progress: "bg-canal-100 text-canal-700 dark:bg-canal-800 dark:text-canal-200",
  resolved: "bg-paddy-100 text-paddy-700 dark:bg-paddy-900/60 dark:text-paddy-200",
  closed: "bg-canal-200 text-canal-600",
};

export default function Complaints() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const { register, handleSubmit, reset } = useForm();

  const isStaff = user && ["super_admin", "admin", "water_operator"].includes(user.role);
  const isFarmer = user?.role === "farmer";

  const load = () => {
    setLoading(true);
    setLoadError("");
    api.get("/api/complaints")
      .then((r) => setComplaints(Array.isArray(r.data) ? r.data : []))
      .catch((e) => setLoadError(e?.response?.data?.detail || "Could not load complaints. Please refresh."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (data: any) => {
    setSubmitError("");
    setSubmitting(true);
    try {
      // For farmers, don't send farmer_id — backend resolves from token
      const payload: any = {
        category: data.category,
        title: data.title || data.category,
        description: data.description,
      };
      if (!isFarmer && data.farmer_id) {
        payload.farmer_id = Number(data.farmer_id);
      }
      await api.post("/api/complaints", payload);
      reset();
      setShowForm(false);
      load();
    } catch (e: any) {
      setSubmitError(e?.response?.data?.detail || "Could not submit complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async (id: number) => {
    try {
      await api.patch(`/api/complaints/${id}/reply`, { admin_reply: replyText, status: "resolved" });
      setReplyingId(null);
      setReplyText("");
      load();
    } catch {
      // silent — UI will reflect unchanged state
    }
  };

  const nepaliCategories: Record<string, string> = {
    "Leakage": "पानी चुहावट",
    "No Water": "पानी छैन",
    "Late Supply": "ढिलो आपूर्ति",
    "Broken Canal": "नहर क्षति",
    "Other Issues": "अन्य समस्या",
  };

  const getCatLabel = (cat: string) => lang === "ne" ? (nepaliCategories[cat] || cat) : cat;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">{t("complaints_title")}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-canal-600 hover:bg-canal-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> {t("new_complaint")}
        </button>
      </div>

      {loadError && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={16} /> {loadError}
          <button onClick={load} className="ml-auto text-xs underline">
            {lang === "ne" ? "पुनः प्रयास" : "Retry"}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 gap-3 text-canal-500">
          <div className="w-5 h-5 border-2 border-canal-400 border-t-canal-600 rounded-full animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      )}

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 relative">
          <button onClick={() => { setShowForm(false); setSubmitError(""); }} className="absolute top-4 right-4"><X size={18} /></button>
          <h3 className="font-display font-semibold mb-4">{t("new_complaint")}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isStaff && (
              <input {...register("farmer_id")} placeholder={lang === "ne" ? "किसान ID" : "Farmer ID (optional)"} type="number" className="input" />
            )}
            <select {...register("category", { required: true })} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{getCatLabel(c)}</option>)}
            </select>
            <input {...register("title")} placeholder={lang === "ne" ? "शीर्षक" : "Title"} className="input sm:col-span-2" />
            <textarea {...register("description")} placeholder={lang === "ne" ? "समस्याको विवरण..." : "Describe the issue..."} className="input sm:col-span-2" rows={3} />

            {submitError && (
              <p className="sm:col-span-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="sm:col-span-2 bg-paddy-600 hover:bg-paddy-700 text-white font-medium rounded-xl py-2.5 transition-colors disabled:opacity-60"
            >
              {submitting ? t("filing_complaint") : t("file_complaint")}
            </button>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!loading && complaints.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="flex items-center gap-2 font-medium">
                <MessageSquareWarning size={16} className="text-rose-500" /> {getCatLabel(c.category)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[c.status]}`}>
                {c.status.replace("_", " ")}
              </span>
            </div>
            {c.title && <p className="text-sm font-medium text-canal-800 dark:text-canal-100 mb-1">{c.title}</p>}
            {c.description && <p className="text-sm text-canal-700 dark:text-canal-200 mb-2">{c.description}</p>}
            <p className="text-xs text-canal-400 mb-2">{new Date(c.created_at).toLocaleString()}</p>

            {c.admin_reply && (
              <div className="bg-canal-50 dark:bg-canal-900/40 rounded-lg p-3 text-sm mt-2">
                <p className="text-xs text-canal-500 mb-1">{lang === "ne" ? "एडमिनको जवाफ" : "Admin Reply"}</p>
                {c.admin_reply}
              </div>
            )}

            {isStaff && !c.admin_reply && (
              replyingId === c.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={lang === "ne" ? "जवाफ लेख्नुहोस्..." : "Write a reply..."} className="input" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => sendReply(c.id)} className="bg-canal-600 text-white text-xs px-3 py-1.5 rounded-lg">
                      {lang === "ne" ? "जवाफ पठाउनुहोस्" : "Send Reply"}
                    </button>
                    <button onClick={() => setReplyingId(null)} className="text-xs px-3 py-1.5 rounded-lg border border-canal-300">
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setReplyingId(c.id)} className="text-xs text-canal-600 font-medium mt-1">
                  {lang === "ne" ? "जवाफ दिनुहोस्" : "Reply"}
                </button>
              )
            )}
          </motion.div>
        ))}
        {!loading && complaints.length === 0 && (
          <p className="text-sm text-canal-500 col-span-full text-center py-10">{t("no_complaints_yet")}</p>
        )}
      </div>
    </div>
  );
}
