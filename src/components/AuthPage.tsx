/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  signInWithGoogle, 
  signUpWithEmail, 
  signInWithEmail 
} from "../firebase";
import { User } from "../types";
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  CheckCircle, 
  Info, 
  Award, 
  AlertCircle,
  Loader2,
  Building
} from "lucide-react";
import { motion } from "motion/react";

interface AuthPageProps {
  onAuthSuccess: (user: User) => void;
  onSkip?: () => void;
}

export default function AuthPage({ onAuthSuccess, onSkip }: AuthPageProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      setIsSuccess(true);
      setTimeout(() => {
        onAuthSuccess(user);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Please fill out all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let user: User;
      if (mode === "signup") {
        user = await signUpWithEmail(email, password, name);
      } else {
        user = await signInWithEmail(email, password);
      }
      setIsSuccess(true);
      setTimeout(() => {
        onAuthSuccess(user);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-slate-50/50" id="auth-portal-screen">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
        
        {/* Left Side: Brand Marketing & Civic Gamification Showcase */}
        <div className="md:col-span-5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Ambient visual layers */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="w-full h-full" style={{ 
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)", 
              backgroundSize: "20px 20px, 40px 40px, 40px 40px" 
            }} />
          </div>

          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                <ShieldCheck className="w-5.5 h-5.5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">CommunityHero</span>
            </div>

            <div className="space-y-4 pt-4">
              <h1 className="text-3xl font-extrabold tracking-tight leading-tight md:text-4xl">
                Become a Local Civic Guardian.
              </h1>
              <p className="text-blue-100 text-sm leading-relaxed">
                Connect directly with city managers, report local safety hazards, verify issues near you, and earn reputation badges.
              </p>
            </div>
          </div>

          {/* Civic Gamification highlights */}
          <div className="space-y-4 mt-8 md:mt-0 relative z-10">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xs flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Gamified Rep System</h4>
                <p className="text-[11px] text-blue-100 leading-normal mt-0.5">
                  Gain XP and Level Up for every successfully resolved municipal issue report and community consensus upvote.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xs flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-lg bg-blue-400/20 text-blue-300 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Verified Local Trust</h4>
                <p className="text-[11px] text-blue-100 leading-normal mt-0.5">
                  Our secure GIS engine matches coordinates to confirm on-the-ground verifications accurately and transparently.
                </p>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-blue-200/80 mt-6 relative z-10 flex justify-between items-center">
            <span>Enterprise GIS Network • SF</span>
            <span>Version 2.4</span>
          </div>
        </div>

        {/* Right Side: Sign In / Sign Up Forms */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white relative">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 max-w-xs mb-6">
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === "signin"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === "signup"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Sign Up
              </button>
            </div>

            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {mode === "signin" ? "Welcome back, Hero" : "Create a new account"}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5">
              {mode === "signin" 
                ? "Sign in to view active safety grids and update reported incidents." 
                : "Register with email or use Google to instant-bootstrap your profile."}
            </p>
          </div>

          {/* Success screen state */}
          {isSuccess ? (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12 space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-slate-800">Authentication Successful</h3>
                <p className="text-xs text-slate-500">Redirecting to your dashboard secure layer...</p>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Error Callout */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl p-3.5 flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {error}
                  </div>
                </div>
              )}

              {/* Name Field (Sign Up only) */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. Sarah Connor"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={mode === "signup"}
                      disabled={loading}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-semibold"
                    />
                    <UserIcon className="w-4 h-4 text-slate-450 absolute left-3.5 top-3" />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-semibold"
                  />
                  <Mail className="w-4 h-4 text-slate-450 absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-semibold"
                  />
                  <Lock className="w-4 h-4 text-slate-450 absolute left-3.5 top-3" />
                </div>
                {mode === "signup" && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Must be at least 6 characters long.
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Secure Portal...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === "signin" ? "Sign In" : "Register Profile"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold">
                  <span className="bg-white px-3 text-slate-400">Or continue with</span>
                </div>
              </div>

              {/* Google Auth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl py-3 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {/* Standard Google SVG Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-5.01-4.53z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Pre-configured Demo Accounts / Quick Access */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3 mt-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Pre-Configured City Officials</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("admin@communityhero.gov");
                        setPassword("AdminPassword123");
                        setError(null);
                      }}
                      className="flex flex-col items-start p-2 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all text-left group cursor-pointer w-full"
                    >
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Admin Chief</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">Click to auto-fill</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("officer@communityhero.gov");
                        setPassword("OfficerPassword123");
                        setError(null);
                      }}
                      className="flex flex-col items-start p-2 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all text-left group cursor-pointer w-full"
                    >
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Officer Miller</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">Click to auto-fill</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>Department Crew Accounts</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("publicworks@communityhero.gov");
                        setPassword("WorksPassword123");
                        setError(null);
                      }}
                      className="flex flex-col items-start p-2 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all text-left group cursor-pointer w-full"
                    >
                      <span className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate w-full">Public Works</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">WorksPassword123</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("watersewage@communityhero.gov");
                        setPassword("WaterPassword123");
                        setError(null);
                      }}
                      className="flex flex-col items-start p-2 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all text-left group cursor-pointer w-full"
                    >
                      <span className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate w-full">Water & Sewage</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">WaterPassword123</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("sanitation@communityhero.gov");
                        setPassword("SanitationPassword123");
                        setError(null);
                      }}
                      className="flex flex-col items-start p-2 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all text-left group cursor-pointer w-full"
                    >
                      <span className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate w-full">Sanitation Crew</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">SanitationPassword123</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("electrical@communityhero.gov");
                        setPassword("ElectricalPassword123");
                        setError(null);
                      }}
                      className="flex flex-col items-start p-2 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all text-left group cursor-pointer w-full"
                    >
                      <span className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate w-full">Electrical Grid</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">ElectricalPassword123</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Skip / Guest Link */}
              {onSkip && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={onSkip}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Skip authentication and browse as Guest
                  </button>
                </div>
              )}

            </form>
          )}

          {/* Alert explaining active mode */}
          <div className="mt-8 p-3 bg-slate-50 border border-slate-200/50 rounded-xl text-[10px] text-slate-400 flex gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              If Firebase connection experiences network latency, a secure offline-local credentials sandbox will automatically wrap your session smoothly.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
