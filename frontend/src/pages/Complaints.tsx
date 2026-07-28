import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Plus, X, MessageSquareWarning } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

interface Complaint {
  id: number;
  farmer_id: number;
  category: string;
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
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const { register, handleSubmit, reset } = useForm();

  const isStaff = user && ["super_admin", "admin", "water_operator"].includes(user.role);

  const load = () => api.get("/api/complaints").then((r) => setComplaints(r.data));
  useEffect(() => { load(); }, []);

  const onSubmit = async (data: any) => {
    await api.post("/api/complaints", { ...data, farmer_id: Number(data.farmer_id) });
    reset();
    setShowForm(false);
    load();
  };

  const sendReply = async (id: number) => {
    await api.patch(`/api/complaints/${id}/reply`, { admin_reply: replyText, status: "resolved" });
    setReplyingId(null);
    setReplyText("");
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Complaints</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-canal-600 hover:bg-canal-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
        >
          <Plus size={16} /> File Complaint
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 relative">
          <button onClick={() => setShowForm(false)} className="absolute top-4 right-4"><X size={18} /></button>
          <h3 className="font-display font-semibold mb-4">New Complaint</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input {...register("farmer_id", { required: true })} placeholder="Farmer ID" type="number" className="input" />
            <select {...register("category", { required: true })} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea {...register("description")} placeholder="Describe the issue..." className="input sm:col-span-2" rows={3} />
            <button type="submit" className="sm:col-span-2 bg-paddy-600 hover:bg-paddy-700 text-white font-medium rounded-xl py-2.5">
              Submit Complaint
            </button>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {complaints.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="flex items-center gap-2 font-medium"><MessageSquareWarning size={16} className="text-rose-500" /> {c.category}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[c.status]}`}>{c.status.replace("_", " ")}</span>
            </div>
            {c.description && <p className="text-sm text-canal-700 dark:text-canal-200 mb-2">{c.description}</p>}
            <p className="text-xs text-canal-400 mb-2">{new Date(c.created_at).toLocaleString()}</p>

            {c.admin_reply && (
              <div className="bg-canal-50 dark:bg-canal-900/40 rounded-lg p-3 text-sm mt-2">
                <p className="text-xs text-canal-500 mb-1">Admin Reply</p>
                {c.admin_reply}
              </div>
            )}

            {isStaff && !c.admin_reply && (
              replyingId === c.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." className="input" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => sendReply(c.id)} className="bg-canal-600 text-white text-xs px-3 py-1.5 rounded-lg">Send Reply</button>
                    <button onClick={() => setReplyingId(null)} className="text-xs px-3 py-1.5 rounded-lg border border-canal-300">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setReplyingId(c.id)} className="text-xs text-canal-600 font-medium mt-1">Reply</button>
              )
            )}
          </motion.div>
        ))}
        {complaints.length === 0 && <p className="text-sm text-canal-500 col-span-full text-center py-10">No complaints filed.</p>}
      </div>
    </div>
  );
}
