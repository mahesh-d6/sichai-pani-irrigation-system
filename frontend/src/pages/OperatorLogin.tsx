import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wrench, Mail, Lock, LogIn, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import GoogleButton from "../components/GoogleButton";

import { Fingerprint } from "lucide-react";
import { authenticateDeviceBiometric, enrollDeviceBiometric, hasEnrolledBiometric } from "../services/biometricAuth";

interface LoginForm {
  email: string;
  password: string;
}

export default function OperatorLogin() {
  const { loginOperator, loginWithGoogle, setUser } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const handlePostLogin = async (userObj: any, tokenStr: string) => {
    if (!hasEnrolledBiometric("water_operator")) {
      await enrollDeviceBiometric("water_operator", userObj, tokenStr);
    }
    navigate("/");
  };

  const onSubmit = async (data: LoginForm) => {
    setError("");
    setLoading(true);
    try {
      await loginOperator(data.email, data.password);
      const storedUser = JSON.parse(localStorage.getItem("sichai_user") || "{}");
      const storedToken = localStorage.getItem("sichai_token") || "";
      await handlePostLogin(storedUser, storedToken);
    } catch (e: any) {
      setError(e?.response?.data?.detail || t("invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setError("");
    if (!hasEnrolledBiometric("water_operator")) {
      setError(lang === "ne" ? "फिंगरप्रिन्ट लगइन पहिले दर्ता गरिएको छैन। कृपया १ पटक लगइन गर्नुहोस्।" : "No Operator fingerprint registered yet. Please log in with password once.");
      return;
    }
    const session = await authenticateDeviceBiometric("water_operator");
    if (session) {
      localStorage.setItem("sichai_token", session.token);
      localStorage.setItem("sichai_user", JSON.stringify(session.user));
      setUser(session.user);
      navigate("/");
    } else {
      setError(lang === "ne" ? "फिंगरप्रिन्ट वा फेश अनलक प्रमाणीकरण असफल भयो।" : "Biometric / Device unlock failed or cancelled.");
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError("");
    try {
      const outcome = await loginWithGoogle(credential, "operator");
      if (outcome.status === "logged_in") {
        const storedUser = JSON.parse(localStorage.getItem("sichai_user") || "{}");
        const storedToken = localStorage.getItem("sichai_token") || "";
        await handlePostLogin(storedUser, storedToken);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not sign in with Google.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ripple p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-canal-300/30 blur-3xl animate-ripple" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-paddy-300/30 blur-3xl animate-ripple" />

      <button
        onClick={() => setLang(lang === "en" ? "ne" : "en")}
        className="absolute top-5 right-5 z-20 glass rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-white/90 transition-colors shadow-sm"
      >
        {lang === "en" ? "नेपाली" : "English"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10 shadow-xl"
      >
        <Link to="/login" className="flex items-center gap-1.5 text-xs text-canal-500 hover:text-canal-700 mb-4 font-medium">
          <ArrowLeft size={13} /> {t("back")}
        </Link>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-earth-800 flex items-center justify-center mb-3 shadow-lg">
            <Wrench className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-earth-900 dark:text-canal-50">{t("operator_login_title")}</h1>
          <p className="text-sm text-canal-600 dark:text-canal-300">{t("operator_login_subtitle")}</p>
        </div>

        <button
          type="button"
          onClick={handleFingerprintLogin}
          className="w-full mb-5 flex items-center justify-center gap-2 border border-canal-300 dark:border-canal-600 bg-white/80 dark:bg-canal-900/60 hover:bg-canal-50 dark:hover:bg-canal-800 text-canal-800 dark:text-canal-100 rounded-xl py-2.5 text-xs font-semibold shadow-sm transition-colors"
        >
          <Fingerprint size={18} className="text-earth-700 dark:text-earth-300" />
          <span>{lang === "ne" ? "👆 अपरेटर फिंगरप्रिन्ट लगइन" : "👆 Sign in with Operator Fingerprint"}</span>
        </button>

        <div className="flex flex-col items-center gap-4 mb-6">
          <GoogleButton onCredential={handleGoogleCredential} onError={setError} />
          <div className="flex items-center gap-3 w-full">
            <div className="h-px bg-canal-200 dark:bg-canal-700 flex-1" />
            <span className="text-xs text-canal-400 font-medium">{t("or_sign_in_with_email")}</span>
            <div className="h-px bg-canal-200 dark:bg-canal-700 flex-1" />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t("gmail_address")}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-400" size={18} />
              <input
                {...register("email", { required: "Required" })}
                type="email"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/70 dark:bg-canal-900/40 border border-canal-200 dark:border-canal-700 focus:outline-none focus:ring-2 focus:ring-canal-500"
                placeholder="operator@sichaipani.com"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t("password")}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                {...register("password", { required: "Required" })}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/70 dark:bg-canal-900/40 border border-canal-200 dark:border-canal-700 focus:outline-none focus:ring-2 focus:ring-canal-500"
                placeholder="••••••••"
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
            className="flex items-center justify-center gap-2 bg-earth-800 hover:bg-earth-900 text-white font-medium rounded-xl py-2.5 transition-colors disabled:opacity-60 shadow-md"
          >
            <LogIn size={18} />
            {loading ? t("signing_in") : t("sign_in")}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
