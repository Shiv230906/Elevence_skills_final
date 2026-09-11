import Sidebar from "@/component/Sidebar";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Footer from "@/component/Footer";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import { useDispatch } from "react-redux";
import { useEffect } from "react";

import { auth } from "@/firebase/firebase";
import { login, logout, adminLogin } from "@/feature/userSlice";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "@/translations/index";

import { useRouter } from "next/router";

const AuthListener = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    // Restore admin session from localStorage on startup
    const isAdminActive =
      typeof window !== "undefined" && localStorage.getItem("adminSession") === "true";
    if (isAdminActive) {
      dispatch(adminLogin());
    }

    const unsubscribe = auth.onAuthStateChanged((authuser) => {
      const adminActive =
        typeof window !== "undefined" && localStorage.getItem("adminSession") === "true";
      if (adminActive) {
        dispatch(adminLogin());
        return;
      }

      if (authuser) {
        // Detect if the signed-in Firebase user authenticated via Google
        const isGoogleUser = authuser.providerData?.some(
          (p) => p.providerId === "google.com"
        );

        if (isGoogleUser) {
          const uid = authuser.uid;

          // Check if OTP was already verified for this session
          const isOtpVerified =
            typeof window !== "undefined" &&
            sessionStorage.getItem(`otp_verified_${uid}`) === "true";

          if (isOtpVerified) {
            // OTP done → allow Redux login and stay on page
            dispatch(
              login({
                uid: authuser.uid || "",
                photo: authuser.photoURL || "",
                name: authuser.displayName || "",
                email: authuser.email || "",
              })
            );
            // If somehow still on verify-otp page, send back home
            if (router.pathname === "/verify-otp") {
              router.replace("/");
            }
            return;
          }

          // OTP not verified yet.
          // ──────────────────────────────────────────────────────────────────
          // CRITICAL: Only redirect to OTP page if there is an *active login
          // attempt* in progress (i.e., `pending_otp_login` was set by the
          // handlelogin function in Sidebar.tsx right after the Google popup
          // succeeded). Do NOT redirect just because a Firebase session exists
          // (which happens on every page refresh for a previously-signed-in user).
          // ──────────────────────────────────────────────────────────────────
          const hasPendingOtp =
            typeof window !== "undefined" &&
            Boolean(sessionStorage.getItem("pending_otp_login"));

          if (hasPendingOtp) {
            // Active login attempt exists → ensure user is NOT in Redux yet
            dispatch(logout());

            // Guard: if they navigated away from /verify-otp, redirect back
            const publicRoutes = ["/verify-otp", "/adminlogin", "/forgot-password"];
            if (!publicRoutes.includes(router.pathname)) {
              router.replace("/verify-otp");
            }
            return;
          }

          // No pending login attempt AND no OTP verified:
          // This is a stale Firebase session (app startup or page refresh).
          // In this case we silently sign the user out so they are treated
          // as a guest. They must log in again and complete OTP verification.
          dispatch(logout());
          return;
        }

        // NON-GOOGLE LOGIN (e.g. email/password login):
        // No OTP required — dispatch login directly.
        dispatch(
          login({
            uid: authuser.uid || "",
            photo: authuser.photoURL || "",
            name: authuser.displayName || "",
            email: authuser.email || "",
          })
        );
      } else {
        dispatch(logout());
      }
    });

    return () => unsubscribe();
  }, [dispatch]); // Only runs once on mount — no router dependency to avoid
                  // re-running on every navigation change.

  // Route guard: only enforce the /verify-otp redirect when a login attempt
  // is actively in progress (pending_otp_login is set in sessionStorage).
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only guard if there is an active pending login attempt
    const hasPendingOtp = Boolean(sessionStorage.getItem("pending_otp_login"));
    if (!hasPendingOtp) return; // No active login attempt → no redirect needed

    const currentFbUser = auth.currentUser;
    if (!currentFbUser) return;

    const isGoogle = currentFbUser.providerData?.some(
      (p) => p.providerId === "google.com"
    );
    if (!isGoogle) return;

    const uid = currentFbUser.uid;
    const isVerified = sessionStorage.getItem(`otp_verified_${uid}`) === "true";
    const publicRoutes = ["/verify-otp", "/adminlogin", "/forgot-password"];

    if (!isVerified && !publicRoutes.includes(router.pathname)) {
      router.replace("/verify-otp");
    }
  }, [router.pathname]);

  return null;
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Provider store={store}>
      <AuthListener />
      <div className="min-h-screen bg-white flex flex-col">
        <ToastContainer />
        <Sidebar />
        <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300">
          <main className="flex-1 w-full">
            <Component {...pageProps} />
          </main>
          <Footer />
        </div>
      </div>
    </Provider>
  );
}
