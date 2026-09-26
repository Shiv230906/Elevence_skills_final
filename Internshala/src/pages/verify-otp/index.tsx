import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { login } from "@/feature/userSlice";
import { auth } from "@/firebase/firebase";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { ShieldCheck, Clock, ArrowLeft, Loader2, AlertCircle, RefreshCw, Mail } from "lucide-react";

import { BACKEND_URL } from "@/config/api";

import type { LoginType, PendingUser } from "@/types/auth";
export type { LoginType, PendingUser };

export default function VerifyOtpPage() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [otp, setOtp] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [timer, setTimer] = useState<number>(300); // 5 minutes
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to mask email for UI display
  const maskEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes("@")) return emailStr || "";
    const [local, domain] = emailStr.split("@");
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
  };

  // Load pending login info from sessionStorage.
  // The OTP page is ONLY valid when there is an active login attempt
  // (pending_otp_login key set by handlelogin in Sidebar.tsx right after
  // the Google popup succeeds). Any other visit to this page is redirected.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = sessionStorage.getItem("pending_otp_login");
    if (stored) {
      try {
        const parsed: PendingUser = JSON.parse(stored);
        // If OTP was already verified for this UID, go home
        if (parsed.uid && sessionStorage.getItem(`otp_verified_${parsed.uid}`) === "true") {
          router.replace("/");
          return;
        }
        setPendingUser(parsed);
      } catch (e) {
        console.error("Failed to parse pending login:", e);
        // Corrupted data — send to home
        router.replace("/");
      }
    } else {
      // No active login attempt → do NOT show OTP page.
      // Redirect to home whether or not a Firebase user is signed in.
      router.replace("/");
    }
  }, [router]);


  // Countdown timer
  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Submit OTP Verification
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setErrorMessage("Please enter the 6-digit OTP code.");
      return;
    }

    if (trimmedOtp.length !== 6) {
      setErrorMessage("OTP must be 6 digits.");
      return;
    }

    const email = pendingUser?.email || auth.currentUser?.email;
    const uid = pendingUser?.uid || auth.currentUser?.uid;

    if (!email || !uid) {
      setErrorMessage("Session expired. Please sign in again.");
      toast.error("Session expired. Please sign in again.");
      return;
    }

    setErrorMessage("");
    setIsVerifying(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/verify-login-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firebaseUid: uid,
          userEmail: email,
          otp: trimmedOtp,
          historyId: pendingUser?.historyId || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.allowed) {
        // Mark OTP as verified for this UID in both localStorage and sessionStorage
        localStorage.setItem(`otp_verified_${uid}`, "true");
        sessionStorage.setItem(`otp_verified_${uid}`, "true");
        sessionStorage.removeItem("pending_otp_login");

        let userName = pendingUser?.name || auth.currentUser?.displayName || "User";
        let userPhoto = pendingUser?.photo || auth.currentUser?.photoURL || "";

        // Attempt fetching enriched profile from backend database
        try {
          const profileRes = await fetch(`${BACKEND_URL}/api/auth/profile/${uid}`);
          const profileData = await profileRes.json();
          if (profileData.success && profileData.user) {
            userName = profileData.user.name || userName;
            userPhoto = profileData.user.profilePhoto || userPhoto;
          }
        } catch (_) {}

        // Ensure user is registered/upserted in MongoDB User collection for Friends discovery
        fetch(`${BACKEND_URL}/api/users/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: uid,
            name: userName,
            email: email,
            photo: userPhoto,
          }),
        }).catch((err) => console.warn("[Verify OTP] User registration sync notice:", err));

        const currentLoginType = pendingUser?.loginType || (auth.currentUser ? "google" : "credentials");

        if (currentLoginType === "credentials") {
          // Persist credentials user session in localStorage and sessionStorage
          const credsString = JSON.stringify({
            uid: uid,
            name: userName,
            email: email,
            photo: userPhoto,
          });
          localStorage.setItem("credentials_user", credsString);
          sessionStorage.setItem("credentials_user", credsString);
        }

        // Dispatch login to Redux
        dispatch(
          login({
            uid: uid,
            name: userName,
            email: email,
            photo: userPhoto,
          })
        );

        toast.success("Identity verified successfully! Welcome.");
        // Redirect to Home page
        router.replace("/");
      } else {
        const errorText = data.message || "Invalid or expired OTP. Please try again.";
        setErrorMessage(errorText);
        toast.error(errorText);
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      const networkError = "Unable to verify OTP. Please check your network connection.";
      setErrorMessage(networkError);
      toast.error(networkError);
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (isResending) return;

    const email = pendingUser?.email || auth.currentUser?.email;
    const uid = pendingUser?.uid || auth.currentUser?.uid;

    if (!email) {
      toast.error("User session not found. Please log in again.");
      return;
    }

    setIsResending(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/resend-login-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: email,
          loginType: pendingUser?.loginType || "credentials",
          firebaseUid: uid || "pending",
        }),
      });

      const data = await response.json();

      if (response.ok && data.requiresOtp) {
        toast.success("A new verification OTP has been sent to your email.");
        setTimer(300);
        setOtp("");
      } else {
        toast.error(data.message || "Failed to resend OTP. Please try again.");
      }
    } catch (err) {
      console.error("Resend OTP error:", err);
      toast.error("Unable to resend OTP. Please try again.");
    } finally {
      setIsResending(false);
    }
  };


  // Cancel Login
  const handleCancel = async () => {
    try {
      await signOut(auth);
    } catch (_) {}

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pending_otp_login");
      sessionStorage.removeItem("credentials_user");
      sessionStorage.removeItem("auth_provider");
      const uid = pendingUser?.uid || auth.currentUser?.uid;
      if (uid) {
        sessionStorage.removeItem(`otp_verified_${uid}`);
      }
    }
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Verify Login OTP — InternArea</title>
        <meta name="description" content="Security OTP verification for your InternArea account." />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block mb-4">
          <img src="/logo.png" alt="InternArea Logo" className="h-14 mx-auto" />
        </Link>
        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Two-Step Login Verification
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          For your account security, please enter the 6-digit verification code sent to your registered email before accessing the Home page.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          <form onSubmit={handleVerify} className="space-y-6">
            {/* Masked destination indicator */}
            {pendingUser?.email && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Code Sent To
                </p>
                <p className="text-sm font-semibold text-blue-900 font-mono">
                  {maskEmail(pendingUser.email)}
                </p>
              </div>
            )}

            {/* OTP Input */}
            <div>
              <label
                htmlFor="login-otp-input"
                className="block text-sm font-medium text-gray-700 text-center mb-2"
              >
                Enter 6-Digit OTP
              </label>
              <input
                id="login-otp-input"
                type="text"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setOtp(val);
                  if (errorMessage) setErrorMessage("");
                }}
                placeholder="• • • • • •"
                className={`w-full text-center text-2xl tracking-[0.6em] font-mono py-3.5 border rounded-xl text-black focus:outline-none transition-colors ${
                  errorMessage
                    ? "border-red-400 focus:ring-2 focus:ring-red-400"
                    : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                }`}
              />
              {errorMessage && (
                <div className="mt-2 flex items-center justify-center space-x-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Countdown & Resend Option */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  Expires in:{" "}
                  <strong className="text-gray-700 font-mono">
                    {formatTimer(timer)}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || timer > 240}
                className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isResending ? "Resending..." : "Resend Code"}
              </button>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={isVerifying || otp.length !== 6}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isVerifying ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying OTP...</span>
                </div>
              ) : (
                "Verify & Continue to Home"
              )}
            </button>

            {/* Cancel Login */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isVerifying}
                className="inline-flex items-center space-x-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel Login and Return</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
