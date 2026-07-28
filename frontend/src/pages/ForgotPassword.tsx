import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import api from "../services/api";

type Step = "username" | "questions" | "reset" | "done";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchQuestions = async () => {
    setError("");
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/api/auth/farmer/forgot-password/questions", { params: { username } });
      setQuestions(res.data.questions);
      setStep("questions");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not find that username.");
    } finally {
      setLoading(false);
    }
  };

  const verifyAnswers = async () => {
    setError("");
    if (answers.some((a) => !a.trim())) {
      setError("Please answer all three questions.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/farmer/forgot-password/verify", {
        username,
        answer_1: answers[0],
        answer_2: answers[1],
        answer_3: answers[2],
      });
      setResetToken(res.data.reset_token);
      setStep("reset");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "One or more answers were incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/farmer/forgot-password/reset", { reset_token: resetToken, new_password: newPassword });
      setStep("done");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not reset password. Please start over.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ripple p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-paddy-300/30 blur-3xl animate-ripple" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-canal-300/30 blur-3xl animate-ripple" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10"
      >
        <Link to="/farmer/login" className="flex items-center gap-1.5 text-xs text-canal-500 hover:text-canal-700 mb-4">
          <ArrowLeft size={13} /> Back to Sign In
        </Link>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-paddy-600 flex items-center justify-center mb-3 shadow-lg">
            <KeyRound className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold">Forgot Password</h1>
        </div>

        {step === "username" && (
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium">Your Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="your.username" />
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={fetchQuestions} disabled={loading} className="bg-paddy-600 hover:bg-paddy-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5">
              {loading ? "Checking..." : "Continue"}
            </button>
          </div>
        )}

        {step === "questions" && (
          <div className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <div key={i}>
                <label className="text-sm font-medium mb-1 block">{q}</label>
                <input
                  value={answers[i]}
                  onChange={(e) => setAnswers((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))}
                  className="input"
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={verifyAnswers} disabled={loading} className="bg-paddy-600 hover:bg-paddy-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5">
              {loading ? "Verifying..." : "Verify Answers"}
            </button>
          </div>
        )}

        {step === "reset" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-400 hover:text-canal-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pr-10"
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
            <button onClick={submitNewPassword} disabled={loading} className="bg-paddy-600 hover:bg-paddy-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5">
              {loading ? "Saving..." : "Set New Password"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <CheckCircle2 className="text-paddy-600" size={36} />
            <p className="font-medium">Password reset successfully.</p>
            <button onClick={() => navigate("/farmer/login")} className="bg-paddy-600 hover:bg-paddy-700 text-white font-medium rounded-xl py-2.5 px-6 mt-2">
              Go to Sign In
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
