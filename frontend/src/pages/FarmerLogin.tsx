import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sprout, User, Lock, LogIn, Building2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import GoogleButton from "../components/GoogleButton";

interface PasswordForm {
  username: string;
  password: string;
}

export default function FarmerLogin() {
  const { loginFarmer, loginWithGoogle } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<PasswordForm>();

  const onSubmit = async (data: PasswordForm) => {
    setError("");
    setLoading(true);
    try {
      await loginFarmer(data.username, data.password);
      navigate("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail || t("invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError("");
    try {
      const outcome = await loginWithGoogle(credential, "farmer");
      if (outcome.status === "logged_in") {
        navigate("/");
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || t("invalid_credentials"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ripple p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-paddy-300/30 blur-3xl animate-ripple" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-canal-300/30 blur-3xl animate-ripple" />

      <button
        onClick={() => setLang(lang === "en" ? "ne" : "en")}
        className="absolute top-5 right-5 z-20 glass rounded-full px-3 py-1.5 text-xs font-medium"
      >
        {lang === "en" ? "नेपाली" : "English"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-paddy-600 flex items-center justify-center mb-3 shadow-lg">
            <Sprout className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-earth-900 dark:text-canal-50">{t("app_name")}</h1>
          <p className="text-sm text-paddy-600 dark:text-paddy-300">{t("farmer_login_title")}</p>
          <p className="text-xs text-canal-500 dark:text-canal-400 text-center mt-1">
            Your Admin created this account for you. Use the username and password they gave you.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mb-6">
          <GoogleButton onCredential={handleGoogleCredential} onError={setError} />
          <div className="flex items-center gap-3 w-full">
            <div className="h-px bg-canal-200 dark:bg-canal-700 flex-1" />
            <span className="text-xs text-canal-400">{t("or_sign_in_with_email")}</span>
            <div className="h-px bg-canal-200 dark:bg-canal-700 flex-1" />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-400" size={18} />
              <input
                {...register("username", { required: "Required" })}
                className="input pl-10"
                placeholder="your.username"
                autoComplete="username"
              />
            </div>
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("password")}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                {...register("password", { required: "Required" })}
                className="input pl-10 pr-10"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-400 hover:text-canal-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-paddy-600 hover:bg-paddy-700 text-white font-medium rounded-xl py-2.5 transition-colors disabled:opacity-60"
          >
            <LogIn size={18} /> {loading ? t("signing_in") : t("sign_in")}
          </button>
        </form>

        <div className="flex items-center justify-center text-sm mt-4">
          <Link to="/farmer/forgot-password" className="font-medium text-paddy-600 hover:underline">
            Forgot your password?
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-sm mt-4 text-canal-600 dark:text-canal-300">
          <Building2 size={14} />
          {t("staff_member")}
          <Link to="/login" className="font-medium text-canal-600 hover:underline">{t("staff_login_link")}</Link>
        </div>
      </motion.div>
    </div>
  );
}
