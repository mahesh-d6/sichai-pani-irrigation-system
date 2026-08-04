import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface PendingGoogleApprovalModalProps {
  challengeId: string;
  onClose: () => void;
}

export default function PendingGoogleApprovalModal({ challengeId, onClose }: PendingGoogleApprovalModalProps) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "allowed" | "rejected">("pending");

  useEffect(() => {
    let timer: any;
    const poll = async () => {
      try {
        const res = await api.get(`/api/auth/admin/login-challenges/${challengeId}/result`);
        if (res.data.status === "allowed" && res.data.token) {
          setStatus("allowed");
          localStorage.setItem("sichai_token", res.data.token.access_token);
          localStorage.setItem("sichai_user", JSON.stringify(res.data.token.user));
          setUser(res.data.token.user);
          setTimeout(() => {
            navigate("/");
          }, 1200);
          return;
        } else if (res.data.status === "rejected") {
          setStatus("rejected");
          return;
        }
      } catch (e) {
        console.warn("Polling Google approval status failed:", e);
      }
      timer = setTimeout(poll, 2500);
    };

    poll();

    return () => clearTimeout(timer);
  }, [challengeId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-strong rounded-3xl p-6 max-w-sm w-full relative shadow-2xl border border-canal-200 dark:border-canal-700 text-center flex flex-col items-center"
      >
        {status === "pending" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
              <Loader2 size={36} className="animate-spin" />
            </div>
            <h3 className="font-display text-lg font-bold text-earth-900 dark:text-canal-50 mb-1">
              Admin Approval Required
            </h3>
            <p className="text-xs text-canal-600 dark:text-canal-300 mb-5 leading-relaxed">
              Your Google account was unlinked. A login approval request has been sent to the Admin. Please wait for the Admin to approve.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-canal-300 dark:border-canal-600 text-xs font-semibold text-canal-600 dark:text-canal-300 hover:bg-canal-50 dark:hover:bg-canal-800 transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {status === "allowed" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-paddy-500/10 flex items-center justify-center mb-4 text-paddy-600 dark:text-paddy-400">
              <CheckCircle2 size={36} className="animate-bounce" />
            </div>
            <h3 className="font-display text-lg font-bold text-earth-900 dark:text-canal-50 mb-1">
              Approval Granted!
            </h3>
            <p className="text-xs text-paddy-600 dark:text-paddy-400 font-medium">
              Logging you in securely...
            </p>
          </>
        )}

        {status === "rejected" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
              <XCircle size={36} />
            </div>
            <h3 className="font-display text-lg font-bold text-earth-900 dark:text-canal-50 mb-1">
              Request Rejected
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 mb-5">
              The Admin rejected your Google Sign-in request.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition-colors"
            >
              Close
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
