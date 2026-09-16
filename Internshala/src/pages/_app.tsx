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
import type { PendingUser } from "@/types/auth";
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
        const uid = authuser.uid;
        const isOtpVerified =
          typeof window !== "undefined" &&
          sessionStorage.getItem(`otp_verified_${uid}`) === "true";

        if (isOtpVerified) {
          // OTP verified → allow Redux login
          dispatch(
            login({
              uid: authuser.uid || "",
              photo: authuser.photoURL || "",
              name: authuser.displayName || "",
              email: authuser.email || "",
            })
          );
          if (router.pathname === "/verify-otp") {
            router.replace("/");
          }
          return;
        }

        // OTP not verified yet
        const hasPendingOtp =
          typeof window !== "undefined" &&
          Boolean(sessionStorage.getItem("pending_otp_login"));

        if (hasPendingOtp) {
          // Active login attempt in progress → keep logged out in Redux
          dispatch(logout());

          const publicRoutes = ["/login", "/register", "/verify-otp", "/adminlogin", "/forgot-password"];
          if (!publicRoutes.includes(router.pathname)) {
            router.replace("/verify-otp");
          }
          return;
        }

        // Stale session without active login attempt and without OTP verification
        // Treat as guest — do not show OTP on startup or refresh
        dispatch(logout());
        return;
      } else {
        // No Firebase user. Check if credentials user is already OTP-verified in sessionStorage
        if (typeof window !== "undefined") {
          const creds =
            sessionStorage.getItem("credentials_user") ||
            sessionStorage.getItem("pending_otp_login");
          if (creds) {
            try {
              const parsed: PendingUser = JSON.parse(creds);
              const isOtpVerified = sessionStorage.getItem(`otp_verified_${parsed.uid}`) === "true";
              if (isOtpVerified) {
                dispatch(
                  login({
                    uid: parsed.uid || "",
                    photo: parsed.photo || "",
                    name: parsed.name || "",
                    email: parsed.email || "",
                  })
                );
                if (router.pathname === "/verify-otp") {
                  router.replace("/");
                }
                return;
              }
            } catch (_) {}
          }
        }
        dispatch(logout());
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  // Route guard: enforce /verify-otp ONLY when an active login attempt is pending
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pending = sessionStorage.getItem("pending_otp_login");
    if (!pending) return;

    try {
      const parsed: PendingUser = JSON.parse(pending);
      if (parsed.uid && sessionStorage.getItem(`otp_verified_${parsed.uid}`) === "true") {
        return;
      }
    } catch (_) {}

    const publicRoutes = ["/login", "/register", "/verify-otp", "/adminlogin", "/forgot-password"];
    if (!publicRoutes.includes(router.pathname)) {
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
