import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Download, Wallet, Landmark, Banknote, Smartphone, Plus, X,
  Paperclip, CheckCircle2, XCircle, UploadCloud,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

interface Payment {
  id: number;
  water_request_id: number;
  farmer_id: number;
  amount: number;
  method: string;
  status: string;
  invoice_number?: string;
  payment_date: string;
  proof_url?: string | null;
}

interface UnpaidRequest {
  id: number;
  request_date: string;
  total_amount: number;
  total_hours: number;
}

const STAFF_ROLES = ["super_admin", "admin", "water_operator"];

const METHOD_ICON: Record<string, ReactElement> = {
  esewa: <Smartphone size={15} />,
  khalti: <Smartphone size={15} />,
  fonepay: <Smartphone size={15} />,
  bank_transfer: <Landmark size={15} />,
  cash: <Banknote size={15} />,
};

const METHOD_LABEL: Record<string, string> = {
  esewa: "eSewa",
  khalti: "Khalti",
  fonepay: "Fonepay",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
  paid: "bg-paddy-100 text-paddy-700 dark:bg-paddy-900/60 dark:text-paddy-200",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
  refunded: "bg-canal-100 text-canal-700 dark:bg-canal-800 dark:text-canal-200",
};

// Farmers pay online themselves, so cash (collected in person by staff) is
// intentionally left out of their method choices.
const FARMER_METHODS = ["esewa", "khalti", "fonepay", "bank_transfer"];

export default function Payments() {
  const { user } = useAuth();
  const isFarmer = user?.role === "farmer";
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidRequests, setUnpaidRequests] = useState<UnpaidRequest[]>([]);
  const [showPayForm, setShowPayForm] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const load = () => {
    api.get("/api/payments").then((r) => setPayments(r.data));
    if (isFarmer) {
      api
        .get("/api/requests", { params: { payment_status: "pending" } })
        .then((r) => setUnpaidRequests(r.data));
    }
  };

  useEffect(load, [isFarmer]);

  const downloadReceipt = async (id: number, invoice?: string) => {
    const res = await api.get(`/api/payments/${id}/receipt.pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt_${invoice || id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setStatus = async (id: number, status: "paid" | "failed") => {
    setVerifyingId(id);
    try {
      await api.patch(`/api/payments/${id}/status`, { status });
      load();
    } finally {
      setVerifyingId(null);
    }
  };

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-xl font-semibold">Payments</h2>
        <div className="flex items-center gap-3">
          <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
            <Wallet size={16} className="text-paddy-600" />
            <span className="text-sm font-medium">Total Collected: Rs.{totalPaid.toLocaleString()}</span>
          </div>
          {isFarmer && (
            <button
              onClick={() => setShowPayForm(true)}
              className="flex items-center gap-2 bg-canal-600 hover:bg-canal-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
            >
              <Plus size={16} /> Pay Now
            </button>
          )}
        </div>
      </div>

      {isFarmer && showPayForm && (
        <PayForm
          unpaidRequests={unpaidRequests}
          onClose={() => setShowPayForm(false)}
          onPaid={() => { setShowPayForm(false); load(); }}
        />
      )}

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-canal-500 border-b border-canal-200/50 dark:border-canal-700/50">
              <th className="py-3 px-4">Invoice</th>
              <th className="py-3 px-4">Request #</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Proof</th>
              <th className="py-3 px-4">Receipt</th>
              {isStaff && <th className="py-3 px-4">Verify</th>}
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-canal-100/50 dark:border-canal-800/50"
              >
                <td className="py-3 px-4 font-medium">{p.invoice_number || "-"}</td>
                <td className="py-3 px-4">#{p.water_request_id}</td>
                <td className="py-3 px-4 font-medium">Rs.{p.amount}</td>
                <td className="py-3 px-4">
                  <span className="flex items-center gap-1.5 capitalize">{METHOD_ICON[p.method]}{p.method.replace("_", " ")}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                </td>
                <td className="py-3 px-4">{new Date(p.payment_date).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  {p.proof_url ? (
                    <a
                      href={`${api.defaults.baseURL}${p.proof_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-canal-600 hover:text-canal-800 flex items-center gap-1"
                    >
                      <Paperclip size={15} /> View
                    </a>
                  ) : (
                    <span className="text-canal-400 text-xs">-</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <button onClick={() => downloadReceipt(p.id, p.invoice_number)} className="text-canal-600 hover:text-canal-800 flex items-center gap-1">
                    <Download size={15} /> PDF
                  </button>
                </td>
                {isStaff && (
                  <td className="py-3 px-4">
                    {p.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          disabled={verifyingId === p.id}
                          onClick={() => setStatus(p.id, "paid")}
                          className="text-paddy-600 hover:text-paddy-700 disabled:opacity-50"
                          title="Mark verified & paid"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button
                          disabled={verifyingId === p.id}
                          onClick={() => setStatus(p.id, "failed")}
                          className="text-rose-600 hover:text-rose-700 disabled:opacity-50"
                          title="Reject payment"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-canal-400 text-xs">-</span>
                    )}
                  </td>
                )}
              </motion.tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={isStaff ? 9 : 8} className="text-center py-8 text-canal-500">No payments recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayForm({
  unpaidRequests, onClose, onPaid,
}: { unpaidRequests: UnpaidRequest[]; onClose: () => void; onPaid: () => void }) {
  const [requestId, setRequestId] = useState<string>(unpaidRequests[0]?.id ? String(unpaidRequests[0].id) : "");
  const [method, setMethod] = useState<string>("esewa");
  const [proof, setProof] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!requestId) {
      setError("Please select an unpaid water request.");
      return;
    }
    if (!proof) {
      setError("Please upload proof of payment (screenshot or receipt).");
      return;
    }

    const form = new FormData();
    form.append("water_request_id", requestId);
    form.append("method", method);
    if (notes) form.append("notes", notes);
    form.append("proof", proof);

    setSubmitting(true);
    try {
      await api.post("/api/payments", form);
      onPaid();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 relative">
      <button onClick={onClose} className="absolute top-4 right-4"><X size={18} /></button>
      <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
        <UploadCloud size={18} className="text-canal-600" /> Pay for a Water Request
      </h3>

      {unpaidRequests.length === 0 ? (
        <p className="text-sm text-canal-500">You have no outstanding payments right now.</p>
      ) : (
        <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={requestId} onChange={(e) => setRequestId(e.target.value)} className="input">
            {unpaidRequests.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} — {r.request_date} — Rs.{r.total_amount} ({r.total_hours} hrs)
              </option>
            ))}
          </select>

          <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
            {FARMER_METHODS.map((m) => (
              <option key={m} value={m}>{METHOD_LABEL[m]}</option>
            ))}
          </select>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1 block">Proof of Payment (screenshot / receipt)</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(e) => setProof(e.target.files?.[0] || null)}
              className="input"
            />
            <p className="text-xs text-canal-500 mt-1">JPG, PNG, WEBP or PDF, up to 5MB. Staff will verify it before marking your payment as paid.</p>
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="input sm:col-span-2"
          />

          {error && <p className="sm:col-span-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="sm:col-span-2 bg-paddy-600 hover:bg-paddy-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5"
          >
            {submitting ? "Submitting..." : "Submit Payment"}
          </button>
        </form>
      )}
    </motion.div>
  );
}
