import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, LogOut, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function ForceChangePassword() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const strongEnough = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword);
    if (!strongEnough) {
      setError("Password needs 8+ characters, with an uppercase letter, a lowercase letter, a number, and a symbol.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/farmer/force-change-password", { new_password: newPassword });
      if (user) {
        const updated = { ...user, must_change_password: false };
        localStorage.setItem("sichai_user", JSON.stringify(updated));
        setUser(updated);
      }
      setSuccess(true);
      setTimeout(() => navigate("/", { replace: true }), 900);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ripple p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-paddy-300/30 blur-3xl animate-ripple" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-paddy-600 flex items-center justify-center mb-3 shadow-lg">
            <KeyRound className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-center">Set a New Password</h1>
          <p className="text-sm text-canal-500 text-center mt-1">
            You're using a temporary password. Please choose your own before continuing.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pr-10"
                autoComplete="new-password"
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
          <div>
            <label className="text-sm font-medium mb-1 block">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-400 hover:text-canal-600 focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
          {success && (
            <p className="text-sm text-paddy-600 bg-paddy-50 dark:bg-paddy-950/40 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={15} /> Password updated! Taking you to your dashboard...
            </p>
          )}
          <button type="submit" disabled={loading || success} className="bg-paddy-600 hover:bg-paddy-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5">
            {success ? "Saved!" : loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>

        <button onClick={logout} className="flex items-center justify-center gap-1.5 text-xs text-canal-500 hover:text-canal-700 mt-5 mx-auto">
          <LogOut size={13} /> Sign out instead
        </button>
      </motion.div>
    </div>
  );
}
