import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Plus, X, Droplets, CheckCircle2, XCircle, Calendar, Play, Square, Timer, ListChecks, Waves } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

interface Farmer {
  id: number;
  full_name: string;
  farmer_code: string;
}

interface WaterRequest {
  id: number;
  farmer_id: number;
  request_date: string;
  total_hours: number;
  rate_per_hour: number;
  total_amount: number;
  status: string;
  payment_status: string;
  crop?: string;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  actual_total_hours?: number | null;
}

const OPERATOR_ROLES = ["water_operator"];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
  approved: "bg-canal-100 text-canal-700 dark:bg-canal-800 dark:text-canal-200",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
  rescheduled: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200",
  in_progress: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200",
  completed: "bg-paddy-100 text-paddy-700 dark:bg-paddy-900/60 dark:text-paddy-200",
};

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  let cleanIso = iso.trim();
  if (cleanIso.includes("T") && !cleanIso.endsWith("Z") && !cleanIso.slice(11).includes("+") && !cleanIso.slice(11).includes("-")) {
    cleanIso += "Z";
  }
  const d = new Date(cleanIso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getTodayLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

import IrrigationCostEstimator from "../components/IrrigationCostEstimator";

export default function WaterRequests() {
  const { user } = useAuth();
  const isFarmer = user?.role === "farmer";
  const canOperate = !!user && OPERATOR_ROLES.includes(user.role);

  const [requests, setRequests] = useState<WaterRequest[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { farmer_id: "", request_date: getTodayLocalDateString(), crop: "", remarks: "" },
  });

  const load = () => {
    api.get("/api/requests").then((r) => setRequests(r.data));
    // Farmers only ever get their own single record back from this
    // endpoint now, so the picker below is skipped for them entirely.
    if (!isFarmer) {
      api.get("/api/farmers").then((r) => setFarmers(r.data));
    }
  };

  useEffect(load, [isFarmer]);

  const onSubmit = async (data: any) => {
    // No time window is collected here anymore -- the Operator's actual
    // Start/Stop button is the only source of timing and billing.
    await api.post("/api/requests", { ...data, farmer_id: isFarmer ? 0 : Number(data.farmer_id) });
    reset();
    setShowForm(false);
    load();
  };

  const updateStatus = async (id: number, status: string) => {
    await api.patch(`/api/requests/${id}/status`, { status });
    load();
  };

  const startWater = async (id: number) => {
    setBusyId(id);
    try {
      await api.post(`/api/requests/${id}/start`);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const stopWater = async (id: number) => {
    setBusyId(id);
    try {
      await api.post(`/api/requests/${id}/stop`);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const farmerName = (id: number) => farmers.find((f) => f.id === id)?.full_name || (isFarmer ? "You" : `Farmer #${id}`);

  const operatorStats = useMemo(() => {
    const awaitingStart = requests.filter((r) => r.status === "approved").length;
    const inProgress = requests.filter((r) => r.status === "in_progress").length;
    const totalHoursDelivered = requests.reduce((sum, r) => sum + (r.actual_total_hours || 0), 0);
    return { awaitingStart, inProgress, totalHoursDelivered: Math.round(totalHoursDelivered * 100) / 100 };
  }, [requests]);

  return (
    <div className="flex flex-col gap-5">
      <IrrigationCostEstimator />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Irrigation Requests</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-canal-600 hover:bg-canal-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
        >
          <Plus size={16} /> New Request
        </button>
      </div>

      {canOperate && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center flex-shrink-0">
              <ListChecks className="text-white" size={18} />
            </div>
            <div>
              <p className="text-xs text-canal-500">Awaiting Start</p>
              <p className="font-display text-xl font-semibold">{operatorStats.awaitingStart}</p>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center flex-shrink-0">
              <Timer className="text-white" size={18} />
            </div>
            <div>
              <p className="text-xs text-canal-500">Currently Running</p>
              <p className="font-display text-xl font-semibold">{operatorStats.inProgress}</p>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-paddy-600 flex items-center justify-center flex-shrink-0">
              <Waves className="text-white" size={18} />
            </div>
            <div>
              <p className="text-xs text-canal-500">Total Hours Delivered</p>
              <p className="font-display text-xl font-semibold">{operatorStats.totalHoursDelivered} hrs</p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 relative">
          <button onClick={() => { setShowForm(false); reset(); }} className="absolute top-4 right-4"><X size={18} /></button>
          <h3 className="font-display font-semibold mb-1 flex items-center gap-2"><Droplets size={18} className="text-canal-600" /> Request Water</h3>
          <p className="text-xs text-canal-500 mb-4">
            Just let us know you need water and when. The Operator will start and stop delivery, and your bill is based on that actual time.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isFarmer && (
              <select {...register("farmer_id", { required: true })} className="input">
                <option value="">Select Farmer</option>
                {farmers.map((f) => <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>)}
              </select>
            )}
            <input {...register("request_date", { required: true })} type="date" className="input" />
            <input {...register("crop")} placeholder="Crop" className="input" />
            <input {...register("remarks")} placeholder="Remarks (optional)" className="input sm:col-span-2" />

            <button type="submit" className="sm:col-span-2 bg-paddy-600 hover:bg-paddy-700 text-white font-medium rounded-xl py-2.5">
              Submit Request
            </button>
          </form>
        </motion.div>
      )}

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-canal-500 border-b border-canal-200/50 dark:border-canal-700/50">
              {!isFarmer && <th className="py-3 px-4">Farmer</th>}
              <th className="py-3 px-4"><Calendar size={13} className="inline mr-1" />Date</th>
              <th className="py-3 px-4">Crop</th>
              <th className="py-3 px-4"><Timer size={13} className="inline mr-1" />Actual Start–Stop</th>
              <th className="py-3 px-4">Total Hours</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-canal-100/50 dark:border-canal-800/50">
                {!isFarmer && <td className="py-3 px-4 font-medium">{farmerName(r.farmer_id)}</td>}
                <td className="py-3 px-4">{r.request_date}</td>
                <td className="py-3 px-4">{r.crop || "-"}</td>
                <td className="py-3 px-4 font-medium text-xs">
                  {r.actual_start_time ? (
                    <span>
                      {fmtTime(r.actual_start_time)} – {r.actual_end_time ? fmtTime(r.actual_end_time) : <span className="text-sky-600 dark:text-sky-400 font-semibold animate-pulse">Running...</span>}
                    </span>
                  ) : (
                    <span className="text-canal-400 font-normal">Not started</span>
                  )}
                </td>
                <td className="py-3 px-4 font-medium">
                  {r.actual_total_hours != null ? `${r.actual_total_hours} hrs` : "-"}
                </td>
                <td className="py-3 px-4 font-medium">Rs.{r.total_amount}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS_STYLES[r.status]}`}>{r.status.replace("_", " ")}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${r.payment_status === "paid" ? "bg-paddy-100 text-paddy-700 dark:bg-paddy-900 dark:text-paddy-200" : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"}`}>
                    {r.payment_status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2 items-center">
                    {canOperate && r.status === "pending" && (
                      <>
                        <button onClick={() => updateStatus(r.id, "approved")} className="text-paddy-600 hover:text-paddy-700" title="Approve"><CheckCircle2 size={18} /></button>
                        <button onClick={() => updateStatus(r.id, "rejected")} className="text-rose-600 hover:text-rose-700" title="Reject"><XCircle size={18} /></button>
                      </>
                    )}
                    {canOperate && r.status === "approved" && (
                      <button
                        onClick={() => startWater(r.id)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        <Play size={13} /> Start
                      </button>
                    )}
                    {canOperate && r.status === "in_progress" && (
                      <button
                        onClick={() => stopWater(r.id)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        <Square size={13} /> Stop
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={isFarmer ? 8 : 9} className="text-center py-8 text-canal-500">No irrigation requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
