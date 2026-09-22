import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  KeyRound,
  Mail,
  Phone,
  ArrowLeft,
  ShieldCheck,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  RotateCw,
  Lock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-toastify";

import { BACKEND_URL } from "@/config/api";

type ResetStep = "IDENTIFIER_INPUT" | "OTP_VERIFICATION" | "PASSWORD_GENERATOR" | "SUCCESS_DISPLAY";

export default function ForgotPassword() {
  const router = useRouter();

  // Current Step
  const [step, setStep] = useState<ResetStep>("IDENTIFIER_INPUT");

  // Step 1: Identifier state
  const [identifier, setIdentifier] = useState("");
  const [inputType, setInputType] = useState<"email" | "phone">("email");
  const [isSubmittingIdentifier, setIsSubmittingIdentifier] = useState(false);
  const [identifierError, setIdentifierError] = useState("");

  // Step 2: OTP state
  const [resetToken, setResetToken] = useState("");
  const [maskedContact, setMaskedContact] = useState("");
  const [otp, setOtp] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes
  const [isResending, setIsResending] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 3: Password Generator state
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingPassword, setIsApplyingPassword] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    if (step === "OTP_VERIFICATION" && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, timerSeconds]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Client-side fallback generator: ONLY [A-Za-z], NO numbers, NO symbols
  const generateClientAlphaPassword = (length = 12): string => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const all = upper + lower;
    let pwd = "";
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    for (let i = 2; i < length; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    return pwd
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  };

  // ── STEP 1: Submit email or phone to request reset OTP ────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentifierError("");

    const trimmedInput = identifier.trim();
    if (!trimmedInput) {
      setIdentifierError("Please enter your registered email or phone number.");
      return;
    }

    if (inputType === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedInput)) {
        setIdentifierError("Please enter a valid email address.");
        return;
      }
    } else {
      const cleanedPhone = trimmedInput.replace(/\D/g, "");
      if (cleanedPhone.length < 10) {
        setIdentifierError("Please enter a valid phone number (at least 10 digits).");
        return;
      }
    }

    try {
      setIsSubmittingIdentifier(true);

      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier: trimmedInput }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResetToken(data.resetToken);
        setMaskedContact(data.maskedContact || trimmedInput);
        setStep("OTP_VERIFICATION");
        setTimerSeconds(600); // 10 mins
        toast.success(data.message || "OTP sent successfully to your contact.");
      } else {
        const errMsg = data.message || "Unable to process request. Please try again.";
        setIdentifierError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      console.error("Forgot password request error:", err);
      const networkErrMsg =
        "Unable to connect to the authentication server. Please check your connection.";
      setIdentifierError(networkErrMsg);
      toast.error(networkErrMsg);
    } finally {
      setIsSubmittingIdentifier(false);
    }
  };

  // ── STEP 2: Verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }

    if (trimmedOtp.length !== 6) {
      setOtpError("OTP must be 6 digits.");
      return;
    }

    try {
      setIsVerifyingOtp(true);

      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resetToken,
          otp: trimmedOtp,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Initial password generation for step 3
        generateNewPassword();
        setStep("PASSWORD_GENERATOR");
        toast.success("OTP verified! Please generate or choose your new password.");
      } else {
        const errMsg = data.message || "Invalid or expired OTP. Please try again.";
        setOtpError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      const networkErrMsg = "Failed to verify OTP. Please try again.";
      setOtpError(networkErrMsg);
      toast.error(networkErrMsg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ── STEP 3: Password Generator ───────────────────────────────────────────
  const generateNewPassword = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password/generate-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.generatedPassword) {
        setGeneratedPassword(data.generatedPassword);
      } else {
        setGeneratedPassword(generateClientAlphaPassword(12));
      }
    } catch {
      setGeneratedPassword(generateClientAlphaPassword(12));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyPassword = async () => {
    if (!generatedPassword) {
      toast.error("Please generate a password first.");
      return;
    }

    try {
      setIsApplyingPassword(true);

      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resetToken,
          newPassword: generatedPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStep("SUCCESS_DISPLAY");
        toast.success(data.message || "Password reset successfully.");
      } else {
        toast.error(data.message || "Failed to update password. Please try again.");
      }
    } catch (err) {
      console.error("Complete reset error:", err);
      toast.error("Unable to update password. Please check your connection.");
    } finally {
      setIsApplyingPassword(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (isResending || !resetToken) return;

    try {
      setIsResending(true);
      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password/resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resetToken }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || "OTP resent successfully.");
        setTimerSeconds(600);
        setOtp("");
        setOtpError("");
      } else {
        toast.error(data.message || "Failed to resend OTP.");
      }
    } catch (err) {
      console.error("Resend OTP error:", err);
      toast.error("Unable to resend OTP. Please try again later.");
    } finally {
      setIsResending(false);
    }
  };

  // ── Copy Generated Password ───────────────────────────────────────────────
  const handleCopyPassword = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setHasCopied(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setHasCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Forgot Password — InternArea</title>
        <meta
          name="description"
          content="Reset your password securely using email or phone with one-time verification."
        />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block mb-4">
          <img src="/logo.png" alt="InternArea Logo" className="h-14 mx-auto" />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          {step === "IDENTIFIER_INPUT" && "Reset Your Password"}
          {step === "OTP_VERIFICATION" && "Verify Security OTP"}
          {step === "PASSWORD_GENERATOR" && "Password Generator"}
          {step === "SUCCESS_DISPLAY" && "Password Reset Successful"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {step === "IDENTIFIER_INPUT" &&
            "Enter your registered email address or phone number to receive a verification code."}
          {step === "OTP_VERIFICATION" &&
            "Enter the 6-digit verification code sent to your registered contact."}
          {step === "PASSWORD_GENERATOR" &&
            "Generate a random secure letter-only password and apply it to your account."}
          {step === "SUCCESS_DISPLAY" &&
            "Your password has been securely updated. You can now login with your new credentials."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 1: Enter Email or Phone                                     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === "IDENTIFIER_INPUT" && (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              {/* Type Switcher Tabs */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setInputType("email");
                    setIdentifierError("");
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 text-sm font-medium rounded-lg transition-all ${
                    inputType === "email"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Email Address</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputType("phone");
                    setIdentifierError("");
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 text-sm font-medium rounded-lg transition-all ${
                    inputType === "phone"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  <span>Phone Number</span>
                </button>
              </div>

              {/* Input field */}
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {inputType === "email"
                    ? "Registered Email Address"
                    : "Registered Phone Number"}
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    {inputType === "email" ? (
                      <Mail className="h-5 w-5" />
                    ) : (
                      <Phone className="h-5 w-5" />
                    )}
                  </div>
                  <input
                    id="identifier"
                    type={inputType === "email" ? "email" : "tel"}
                    required
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (identifierError) setIdentifierError("");
                    }}
                    placeholder={
                      inputType === "email"
                        ? "name@example.com"
                        : "e.g. 9876543210"
                    }
                    className={`block w-full text-black pl-11 pr-4 py-3 border rounded-xl focus:outline-none sm:text-sm transition-colors ${
                      identifierError
                        ? "border-red-400 focus:ring-2 focus:ring-red-400"
                        : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                  />
                </div>
                {identifierError && (
                  <div className="mt-2 flex items-start space-x-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{identifierError}</span>
                  </div>
                )}
              </div>

              {/* Daily Reset Limit Notice */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start space-x-2 text-xs text-blue-800">
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Security Policy:</strong> Password reset requests are limited to{" "}
                  <strong>once per day</strong> per account.
                </span>
              </div>

              {/* Send OTP Button */}
              <button
                type="submit"
                disabled={isSubmittingIdentifier}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmittingIdentifier ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending OTP...</span>
                  </div>
                ) : (
                  "Send OTP"
                )}
              </button>

              {/* Back to Login Link */}
              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center space-x-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Login</span>
                </Link>
              </div>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 2: Enter & Verify OTP                                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === "OTP_VERIFICATION" && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              {/* Masked destination indicator */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-1">
                  OTP Sent To
                </p>
                <p className="text-sm font-semibold text-blue-900 font-mono break-all">
                  {maskedContact}
                </p>
              </div>

              {/* OTP Input */}
              <div>
                <label
                  htmlFor="otp-input"
                  className="block text-sm font-medium text-gray-700 text-center mb-2"
                >
                  Enter OTP
                </label>
                <input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setOtp(val);
                    if (otpError) setOtpError("");
                  }}
                  placeholder="• • • • • •"
                  className={`w-full text-center text-2xl tracking-[0.6em] font-mono py-3.5 border rounded-xl text-black focus:outline-none transition-colors ${
                    otpError
                      ? "border-red-400 focus:ring-2 focus:ring-red-400"
                      : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {otpError && (
                  <div className="mt-2 flex items-center justify-center space-x-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}
              </div>

              {/* Timer & Resend Option */}
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    Expires in:{" "}
                    <strong className="text-gray-700 font-mono">
                      {formatTimer(timerSeconds)}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending || timerSeconds > 540} // Allow resend after 1 min
                  className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isResending ? "Resending..." : "Resend Code"}
                </button>
              </div>

              {/* Verify OTP Button */}
              <button
                type="submit"
                disabled={isVerifyingOtp || otp.length !== 6}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isVerifyingOtp ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying OTP...</span>
                  </div>
                ) : (
                  "Verify OTP"
                )}
              </button>

              {/* Change contact info */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep("IDENTIFIER_INPUT");
                    setOtp("");
                    setOtpError("");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Entered wrong email or phone? Change contact
                </button>
              </div>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 3: Password Generator                                        */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === "PASSWORD_GENERATOR" && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Generate Your New Password
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Click <strong>Generate Password</strong> to create a secure password, then click <strong>Use This Password</strong> to update your account.
                </p>
              </div>

              {/* Password Display Box */}
              <div className="bg-gray-50 border-2 border-dashed border-blue-200 rounded-2xl p-4 sm:p-5">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Generated Password
                </p>

                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-inner">
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-wider text-gray-900 select-all">
                    {isPasswordVisible ? generatedPassword : "••••••••••••"}
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className="text-gray-400 hover:text-gray-600 ml-2 focus:outline-none"
                    title={isPasswordVisible ? "Hide password" : "Show password"}
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className={`mt-3 w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
                    hasCopied
                      ? "bg-green-600 text-white"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                  }`}
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>

              {/* Character Rules Box */}
              <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 text-left flex items-start space-x-2 text-xs text-amber-900">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Password Rules:</p>
                  <p className="text-amber-800">
                    This password contains exclusively uppercase and lowercase letters (A–Z, a–z).
                    It contains <strong>no numbers</strong> and <strong>no special characters</strong>.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Generate Password & Use This Password */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={generateNewPassword}
                  disabled={isGenerating || isApplyingPassword}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-all text-sm disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>{isGenerating ? "Generating..." : "Generate Password"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyPassword}
                  disabled={isApplyingPassword || !generatedPassword}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all text-sm disabled:opacity-50"
                >
                  {isApplyingPassword ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Updating password...</span>
                    </div>
                  ) : (
                    <>
                      <span>Use This Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 4: Display Success                                           */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === "SUCCESS_DISPLAY" && (
            <div className="space-y-6 text-center">
              {/* Success Badge */}
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 ring-8 ring-green-50">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Password reset successfully.
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Your new password has been updated. Please login with your new credentials.
                </p>
              </div>

              {/* Password Reminder Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Your New Password:</p>
                <p className="font-mono text-lg font-bold text-gray-800 tracking-wider">
                  {generatedPassword}
                </p>
              </div>

              {/* Go to Login Button */}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
