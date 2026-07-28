import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Search, Plus, X, Phone, MapPin, Trash2, Eye, EyeOff } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const DELETE_ROLES = ["super_admin", "admin"];
const PERMANENT_DELETE_ROLES = ["super_admin"];

interface Farmer {
  id: number;
  farmer_code: string;
  full_name: string;
  father_name?: string;
  mobile_number: string;
  village?: string;
  land_area?: number;
  crop_type?: string;
  is_active: boolean;
  username?: string;
}

export default function Farmers() {
  const { user } = useAuth();
  const canDelete = !!user && DELETE_ROLES.includes(user.role);
  const canPermanentlyDelete = !!user && PERMANENT_DELETE_ROLES.includes(user.role);

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const load = () => {
    api
      .get("/api/farmers", { params: { search: search || undefined, include_inactive: showInactive } })
      .then((r) => setFarmers(r.data));
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, showInactive]);

  const onSubmit = async (data: any) => {
    setFormError("");
    setSubmitting(true);
    try {
      await api.post("/api/farmers", { ...data, land_area: data.land_area ? Number(data.land_area) : undefined });
      reset();
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || "Could not save this farmer. Please check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (f: Farmer) => {
    if (!window.confirm(`Remove ${f.full_name} (${f.farmer_code})? Their past requests and payments are kept, but they'll be marked inactive and hidden from this list.`)) {
      return;
    }
    setDeletingId(f.id);
    try {
      await api.delete(`/api/farmers/${f.id}`);
      load();
    } finally {
      setDeletingId(null);
    }
  };

  const onPermanentDelete = async (f: Farmer) => {
    if (!window.confirm(`Permanently delete ${f.full_name} (${f.farmer_code}) from the database? This cannot be undone.`)) {
      return;
    }
    setDeletingId(f.id);
    try {
      await api.delete(`/api/farmers/${f.id}/permanent`);
      load();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const detail = err.response.data?.detail || "This farmer has related records.";
        if (window.confirm(`${detail}\n\nDelete everything anyway?`)) {
          try {
            await api.delete(`/api/farmers/${f.id}/permanent`, { params: { force: true } });
            load();
          } catch {
            alert("Could not delete this farmer. Please try again.");
          }
        }
      } else {
        alert("Could not delete this farmer. Please try again.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Farmer Management</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, village..."
              className="pl-9 pr-3 py-2 rounded-xl bg-white/70 dark:bg-canal-900/40 border border-canal-200 dark:border-canal-700 text-sm focus:outline-none focus:ring-2 focus:ring-canal-500 w-56"
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-canal-600 hover:bg-canal-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
          >
            <Plus size={16} /> Add Farmer
          </button>
          {canDelete && (
            <label className="flex items-center gap-2 text-xs text-canal-500 px-2">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show removed
            </label>
          )}
        </div>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 relative">
          <button onClick={() => { setShowForm(false); setFormError(""); }} className="absolute top-4 right-4"><X size={18} /></button>
          <h3 className="font-display font-semibold mb-1">New Farmer</h3>
          <p className="text-xs text-canal-500 mb-4">
            Give this username and temporary password to the farmer directly — they'll be forced to set their own password on first login.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input {...register("full_name", { required: true })} placeholder="Full Name" className="input" />
            <input {...register("father_name")} placeholder="Father's Name" className="input" />
            <input {...register("mobile_number", { required: true })} placeholder="Mobile Number" className="input" />
            <input {...register("email")} placeholder="Email (optional)" className="input" />
            <input {...register("village")} placeholder="Village" className="input" />
            <input {...register("address")} placeholder="Address" className="input" />
            <input {...register("land_area")} placeholder="Land Area (bigha)" type="number" step="0.1" className="input" />
            <input {...register("crop_type")} placeholder="Crop Type" className="input" />

            <div className="sm:col-span-2 h-px bg-canal-200/60 dark:bg-canal-700/60 my-1" />

            <input {...register("username", { required: true })} placeholder="Username (for farmer login)" className="input" />
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("temp_password", { required: true })}
                  placeholder="Temporary Password"
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-400 hover:text-canal-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-canal-500 mt-1">
                8+ characters, with an uppercase letter, a lowercase letter, a number, and a symbol.
              </p>
            </div>

            <div className="sm:col-span-2 text-xs font-medium text-canal-500 mt-1">
              Security questions (used for "Forgot Password" verification)
            </div>
            <input {...register("security_question_1", { required: true })} placeholder="Security Question 1" className="input" />
            <input {...register("security_answer_1", { required: true })} placeholder="Answer 1" className="input" />
            <input {...register("security_question_2", { required: true })} placeholder="Security Question 2" className="input" />
            <input {...register("security_answer_2", { required: true })} placeholder="Answer 2" className="input" />
            <input {...register("security_question_3", { required: true })} placeholder="Security Question 3" className="input" />
            <input {...register("security_answer_3", { required: true })} placeholder="Answer 3" className="input" />

            {formError && (
              <p className="sm:col-span-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="sm:col-span-2 bg-paddy-600 hover:bg-paddy-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5 mt-1"
            >
              {submitting ? "Saving..." : "Save Farmer"}
            </button>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {farmers.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-display font-semibold">{f.full_name}</p>
                <p className="text-xs text-canal-500">{f.farmer_code}{f.username ? ` • login: ${f.username}` : ""}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${f.is_active ? "bg-paddy-100 text-paddy-700 dark:bg-paddy-900 dark:text-paddy-200" : "bg-canal-100 text-canal-500"}`}>
                {f.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm text-canal-700 dark:text-canal-200">
              <span className="flex items-center gap-2"><Phone size={13} /> {f.mobile_number}</span>
              {f.village && <span className="flex items-center gap-2"><MapPin size={13} /> {f.village}</span>}
              {f.crop_type && <span className="text-xs text-canal-500">Crop: {f.crop_type} {f.land_area ? `• ${f.land_area} bigha` : ""}</span>}
            </div>
            {canDelete && f.is_active && (
              <button
                onClick={() => onDelete(f)}
                disabled={deletingId === f.id}
                className="mt-3 flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50"
              >
                <Trash2 size={13} /> {deletingId === f.id ? "Removing..." : "Remove"}
              </button>
            )}
            {canPermanentlyDelete && (
              <button
                onClick={() => onPermanentDelete(f)}
                disabled={deletingId === f.id}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-800 dark:text-rose-400 hover:underline disabled:opacity-50"
              >
                <Trash2 size={13} /> {deletingId === f.id ? "Deleting..." : "Delete Permanently"}
              </button>
            )}
          </motion.div>
        ))}
        {farmers.length === 0 && (
          <p className="text-sm text-canal-500 col-span-full text-center py-10">No farmers found.</p>
        )}
      </div>
    </div>
  );
}
