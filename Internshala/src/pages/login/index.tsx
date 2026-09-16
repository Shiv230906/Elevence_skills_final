import React, { useState, useRef, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { login, logout } from "@/feature/userSlice";
import type { PendingUser } from "@/types/auth";
import { auth, googleProvider } from "@/firebase/firebase";
import { signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isLoggingInRef = useRef(false);

  // Clear any stale pending sessions on entering the login page
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pending_otp_login");
      sessionStorage.removeItem("credentials_user");
      sessionStorage.removeItem("auth_provider");
    }
  }, []);

  // ── Normal Email/Username + Password Login ─────────────────────────────────
  const handleNormalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      const msg = "Please enter both username/email and password.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    try {
      setIsLoading(true);

      // Sign out any active Firebase session to guarantee a clean slate
      try {
        if (auth.currentUser) {
          await signOut(auth);
        }
      } catch (_) {}

      // Validate credentials against backend
      const response = await fetch(`${BACKEND_URL}/api/auth/validate-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText = data.message || "Invalid email/username or password.";
        setErrorMessage(errorText);
        toast.error(errorText);
        return;
      }

      // Credentials are valid! OTP has been dispatched to user's registered email
      if (typeof window !== "undefined") {
        sessionStorage.setItem("auth_provider", "credentials");
        sessionStorage.removeItem(`otp_verified_${data.firebaseUid}`);
        const pendingData: PendingUser = {
          uid: data.firebaseUid,
          email: data.email,
          name: data.name || "User",
          photo: "",
          historyId: data.historyId || null,
          loginType: "credentials",
          identifier: cleanIdentifier,
        };
        sessionStorage.setItem("pending_otp_login", JSON.stringify(pendingData));
      }

      // Ensure user is NOT in Redux yet (OTP required)
      dispatch(logout());

      toast.info(data.message || "Verification OTP sent to your registered email.");
      router.push("/verify-otp");
    } catch (err: any) {
      console.error("Normal login error:", err);
      const netMsg = "Unable to connect to login server. Please check your connection.";
      setErrorMessage(netMsg);
      toast.error(netMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Continue with Google ───────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (isLoggingInRef.current) return;
    isLoggingInRef.current = true;
    setIsGoogleLoading(true);
    setErrorMessage("");

    if (typeof window !== "undefined") {
      localStorage.removeItem("adminSession");
      sessionStorage.removeItem("pending_otp_login");
      sessionStorage.removeItem("credentials_user");
      sessionStorage.removeItem("auth_provider");
    }

    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (_) {}

    let firebaseUser: any = null;

    try {
      const result = await signInWithPopup(auth, googleProvider);
      firebaseUser = result.user;
    } catch (error: any) {
      console.error("Firebase Google Auth Error:", error);

      // Handle popup cancellation safely without crashing the application
      if (
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "auth/popup-closed-by-user"
      ) {
        toast.info("Google sign-in was cancelled. Please try again.");
        isLoggingInRef.current = false;
        setIsGoogleLoading(false);
        return;
      }

      if (error?.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, googleProvider);
          isLoggingInRef.current = false;
          setIsGoogleLoading(false);
          return;
        } catch (redirectErr) {
          console.error("Redirect login error:", redirectErr);
        }
      }

      if (
        error?.code === "auth/unauthorized-domain" ||
        error?.code === "auth/operation-not-allowed" ||
        error?.code === "auth/configuration-not-found" ||
        error?.code === "auth/internal-error"
      ) {
        toast.error("Google authentication configuration issue. Please try email/password login.");
        isLoggingInRef.current = false;
        setIsGoogleLoading(false);
        return;
      }

      toast.error("Google sign-in could not be completed. Please try again.");
      isLoggingInRef.current = false;
      setIsGoogleLoading(false);
      return;
    }

    // Set pending OTP session
    if (typeof window !== "undefined") {
      sessionStorage.setItem("auth_provider", "google");
      sessionStorage.removeItem(`otp_verified_${firebaseUser.uid}`);
      const pendingData: PendingUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "User",
        photo: firebaseUser.photoURL || "",
        historyId: null,
        loginType: "google",
      };
      sessionStorage.setItem("pending_otp_login", JSON.stringify(pendingData));
    }

    // Check backend security rules and trigger OTP
    try {
      const checkRes = await fetch(`${BACKEND_URL}/api/auth/login-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          userEmail: firebaseUser.email,
          loginType: "google",
          isGoogleLogin: true,
        }),
      });

      const checkData = await checkRes.json();

      if (checkData.blocked && checkData.reason === "mobile_time_restriction") {
        toast.error(
          checkData.message || "Mobile login is restricted outside 10:00 AM - 1:00 PM IST."
        );
        await signOut(auth);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_otp_login");
          sessionStorage.removeItem("credentials_user");
          sessionStorage.removeItem("auth_provider");
        }
        isLoggingInRef.current = false;
        setIsGoogleLoading(false);
        return;
      }

      // Sync user profile to database if not yet existing
      fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          fullName: firebaseUser.displayName || "User",
          email: firebaseUser.email,
          profilePhoto: firebaseUser.photoURL || "",
        }),
      }).catch((err) => console.warn("Google user DB sync note:", err));

      if (typeof window !== "undefined") {
        const pendingData: PendingUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "User",
          photo: firebaseUser.photoURL || "",
          historyId: checkData.historyId || null,
          loginType: "google",
        };
        sessionStorage.setItem("pending_otp_login", JSON.stringify(pendingData));
      }

      // Ensure user is not considered logged in in Redux before OTP verification
      dispatch(logout());

      toast.info("Verification OTP sent to your registered email.");
      isLoggingInRef.current = false;
      setIsGoogleLoading(false);
      router.push("/verify-otp");
    } catch (backendErr) {
      console.warn("Backend security check error:", backendErr);
      isLoggingInRef.current = false;
      setIsGoogleLoading(false);
      router.push("/verify-otp");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Login — InternArea / Elevance</title>
        <meta
          name="description"
          content="Login to your InternArea account securely with username, email, or Google."
        />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block mb-4">
          <img src="/logo.png" alt="InternArea Logo" className="h-14 mx-auto" />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Welcome Back
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to access your internships, applications, and profile
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          {errorMessage && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-2 text-sm text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Normal Login Form */}
          <form onSubmit={handleNormalLogin} className="space-y-5">
            {/* Username / Email */}
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username / Email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="Enter email or username"
                  className="block w-full text-black pl-11 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="••••••••••••"
                  className="block w-full text-black pl-11 pr-11 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Main LOGIN Button */}
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying credentials...</span>
                </div>
              ) : (
                "LOGIN"
              )}
            </button>
          </form>

          {/* OR Divider */}
          <div className="mt-6 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-400 font-semibold tracking-wider">
                  OR
                </span>
              </div>
            </div>
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full bg-white hover:bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 flex items-center justify-center space-x-3 text-sm font-semibold text-gray-700 shadow-xs transition-all hover:border-blue-400 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting to Google...</span>
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* New User? Register Link */}
          <div className="mt-6 text-center text-sm text-gray-600">
            New user?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-500 hover:underline transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
