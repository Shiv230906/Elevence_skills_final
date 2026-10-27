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

    const unsubscribe = auth.onAuthStateChanged((authuser: any) => {
      const adminActive =
        typeof window !== "undefined" && localStorage.getItem("adminSession") === "true";
      if (adminActive) {
        dispatch(adminLogin());
        return;
      }

      if (authuser) {
        // Firebase user present — log in immediately, no OTP required
        dispatch(
          login({
            uid: authuser.uid || "",
            photo: authuser.photoURL || "",
            name: authuser.displayName || "",
            email: authuser.email || "",
          })
        );
        return;
      } else {
        // No Firebase user. Check for stored credentials user
        if (typeof window !== "undefined") {
          const creds =
            localStorage.getItem("credentials_user") ||
            sessionStorage.getItem("credentials_user");
          if (creds) {
            try {
              const parsed: PendingUser = JSON.parse(creds);
              if (parsed.uid) {
                dispatch(
                  login({
                    uid: parsed.uid || "",
                    photo: parsed.photo || "",
                    name: parsed.name || "",
                    email: parsed.email || "",
                  })
                );
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
