import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { login, logout, selectuser, selectisAdmin } from "@/feature/userSlice";
import { auth, googleProvider } from "../firebase/firebase";
import { signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { toast } from "react-toastify";
import {
  Home,
  GraduationCap,
  Briefcase,
  CreditCard,
  FileText,
  ClipboardList,
  Globe,
  Users,
  LayoutDashboard,
  PlusCircle,
  PlusSquare,
  ShieldAlert,
  Search,
  Menu,
  X,
  LogOut,
  User as UserIcon,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const Sidebar = () => {
  const user = useSelector(selectuser);
  const isAdminRedux = useSelector(selectisAdmin);
  const dispatch = useDispatch();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [isAdminState, setIsAdminState] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const checkAdmin = () => {
      const localAdmin =
        typeof window !== "undefined" && localStorage.getItem("adminSession") === "true";
      setIsAdminState(Boolean(isAdminRedux || localAdmin));
    };
    checkAdmin();
  }, [isAdminRedux]);

  const isAdmin = Boolean(isAdminRedux || isAdminState);
  const isStudent = !isAdmin && Boolean(user);
  const isGuest = !isAdmin && !user;

  // Close mobile drawer on route change
  useEffect(() => {
    const handleRouteChange = () => setIsMobileOpen(false);
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  // Lock body scroll on mobile when sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  // ── Login State ────────────────────────────────────────────────────────────
  const isLoggingInRef = useRef(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── Chrome OTP Modal State ─────────────────────────────────────────────────
  const [showChromeOtpModal, setShowChromeOtpModal] = useState(false);
  const [chromeOtpValue, setChromeOtpValue] = useState("");
  const [chromeOtpLoading, setChromeOtpLoading] = useState(false);
  const [chromeOtpSent, setChromeOtpSent] = useState(false);
  const pendingLoginRef = useRef<{ firebaseUid: string; userEmail: string; historyId: string | null } | null>(null);

  // ── Language OTP Modal State ───────────────────────────────────────────────
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // ── Abort Chrome Login ─────────────────────────────────────────────────────
  const abortChromeLogin = async () => {
    try {
      await signOut(auth);
    } catch (_) {}
    pendingLoginRef.current = null;
    setChromeOtpValue("");
    setChromeOtpSent(false);
    setChromeOtpLoading(false);
    setShowChromeOtpModal(false);
    isLoggingInRef.current = false;
    setIsLoggingIn(false);
  };

  // ── Main Login Handler ─────────────────────────────────────────────────────
  const handlelogin = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoggingInRef.current) return;
    isLoggingInRef.current = true;
    setIsLoggingIn(true);

    if (typeof window !== "undefined") {
      localStorage.removeItem("adminSession");
      // Clear any leftover OTP session data from a previous attempt so we
      // always start a fresh login flow.
      sessionStorage.removeItem("pending_otp_login");
      sessionStorage.removeItem("credentials_user");
      sessionStorage.removeItem("auth_provider");
    }

    // Sign out any existing Firebase session before starting a new popup.
    // This prevents onAuthStateChanged from seeing the old Google user and
    // triggering an unexpected OTP redirect during the new login attempt.
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
      console.error("Firebase Auth Error:", error);

      if (
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "auth/popup-closed-by-user"
      ) {
        toast.info("Google sign-in was cancelled. Please try again.");
        isLoggingInRef.current = false;
        setIsLoggingIn(false);
        return;
      }
      if (error?.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, googleProvider);
          isLoggingInRef.current = false;
          setIsLoggingIn(false);
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
        dispatch(
          login({
            name: "Rahul",
            email: "rahul@example.com",
            photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces",
          })
        );
        if (error?.code === "auth/unauthorized-domain") {
          toast.warn("Add your domain to Firebase Console -> Authorized Domains. Logged in as Demo User.");
        } else {
          toast.info("Logged in as Demo User");
        }
        isLoggingInRef.current = false;
        setIsLoggingIn(false);
        return;
      }
      toast.error(error?.message || "Login failed");
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem("auth_provider", "google");
      sessionStorage.removeItem(`otp_verified_${firebaseUser.uid}`);
      sessionStorage.setItem(
        "pending_otp_login",
        JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || "User",
          photo: firebaseUser.photoURL || "",
          historyId: null,
          loginType: "google",
        })
      );
    }

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
        toast.error(t("loginSecurity.mobileTimeRestriction"), { autoClose: 6000 });
        await signOut(auth);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_otp_login");
          sessionStorage.removeItem("credentials_user");
          sessionStorage.removeItem("auth_provider");
        }
        isLoggingInRef.current = false;
        setIsLoggingIn(false);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "pending_otp_login",
          JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "User",
            photo: firebaseUser.photoURL || "",
            historyId: checkData.historyId || null,
            loginType: "google",
          })
        );
      }

      dispatch(logout());
      toast.info(t("loginSecurity.otpSent") || "Verification OTP sent to your registered email.");
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
      router.push("/verify-otp");
      return;
    } catch (backendErr) {
      console.warn("[Auth] Backend security check error, proceeding to OTP page:", backendErr);
      dispatch(logout());
      toast.info("Proceeding to OTP verification.");
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
      router.push("/verify-otp");
      return;
    }
  };

  // ── Chrome OTP Verify Handler ──────────────────────────────────────────────
  const handleChromeOtpVerify = async () => {
    if (!chromeOtpValue.trim()) {
      toast.error(t("otp.enterOtpError"));
      return;
    }
    if (!pendingLoginRef.current) {
      toast.error("Session expired. Please login again.");
      await abortChromeLogin();
      return;
    }

    setChromeOtpLoading(true);
    try {
      const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUid: pendingLoginRef.current.firebaseUid,
          userEmail: pendingLoginRef.current.userEmail,
          otp: chromeOtpValue.trim(),
          historyId: pendingLoginRef.current.historyId,
        }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.allowed) {
        const fbUser = auth.currentUser;
        dispatch(
          login({
            uid: pendingLoginRef.current.firebaseUid,
            name: fbUser?.displayName || "",
            email: pendingLoginRef.current.userEmail,
            photo: fbUser?.photoURL || "",
          })
        );
        toast.success("Logged in successfully");
        pendingLoginRef.current = null;
        setChromeOtpValue("");
        setChromeOtpSent(false);
        setShowChromeOtpModal(false);
        isLoggingInRef.current = false;
        setIsLoggingIn(false);
      } else {
        toast.error(verifyData.message || t("loginSecurity.invalidOtp"));
      }
    } catch (err) {
      console.error("OTP verify error:", err);
      toast.error("Unable to verify OTP. Please try again.");
    } finally {
      setChromeOtpLoading(false);
    }
  };

  // ── Logout Handler ─────────────────────────────────────────────────────────
  const handlelogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adminSession");
      if (user?.uid) {
        sessionStorage.removeItem(`otp_verified_${user.uid}`);
      }
      sessionStorage.removeItem("pending_otp_login");
      sessionStorage.removeItem("credentials_user");
      sessionStorage.removeItem("auth_provider");
    }
    signOut(auth);
    dispatch(logout());
    setIsAdminState(false);
    setIsMobileOpen(false);
    toast.info("Logged out successfully");
    router.push("/");
  };

  // ── Language Change Flow ───────────────────────────────────────────────────
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setSelectedLanguage(selected);
    setShowOtpModal(true);
  };

  // ── Helper: Check Active Route ─────────────────────────────────────────────
  const isRouteActive = (href: string) => {
    if (href === "/") {
      return router.pathname === "/";
    }
    if (href === "/internships") {
      return (
        router.pathname.startsWith("/internships") ||
        router.pathname.startsWith("/detailinternship")
      );
    }
    if (href === "/job") {
      return (
        router.pathname.startsWith("/job") ||
        router.pathname.startsWith("/detailjob")
      );
    }
    if (href === "/viewapplication") {
      return (
        router.pathname.startsWith("/viewapplication") ||
        router.pathname.startsWith("/detailapplication")
      );
    }
    return router.pathname === href || router.pathname.startsWith(`${href}/`);
  };

  // ── Navigation Items Definition ────────────────────────────────────────────
  const commonNavItems = [
    {
      href: "/",
      label: t("navbar.home", "Home"),
      icon: Home,
    },
    ...(!isAdmin
      ? [
          {
            href: "/internships",
            label: t("navbar.internships"),
            icon: GraduationCap,
          },
          {
            href: "/job",
            label: t("navbar.jobs"),
            icon: Briefcase,
          },
          {
            href: "/plans",
            label: t("navbar.plans"),
            icon: CreditCard,
          },
        ]
      : []),
  ];

  const studentNavItems = isStudent
    ? [
        {
          href: "/resume/builder",
          label: "Resume Builder",
          icon: FileText,
        },
        {
          href: "/viewapplication",
          label: t("navbar.applications"),
          icon: ClipboardList,
        },
        {
          href: "/public-space",
          label: t("publicSpace.title", "Public Space"),
          icon: Globe,
        },
        {
          href: "/friends",
          label: t("friends.title", "Friends"),
          icon: Users,
        },
      ]
    : [];

  const adminNavItems = isAdmin
    ? [
        {
          href: "/adminpanel",
          label: "Admin Dashboard",
          icon: LayoutDashboard,
        },
        {
          href: "/postJob",
          label: "Post Job",
          icon: PlusCircle,
        },
        {
          href: "/postInternship",
          label: "Post Internship",
          icon: PlusSquare,
        },
        {
          href: "/applications",
          label: "Applications",
          icon: ClipboardList,
        },
      ]
    : [];

  // Render navigation link item
  const renderNavLink = (item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const active = isRouteActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsMobileOpen(false)}
        className={`group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          active
            ? "bg-blue-50 text-blue-600 font-semibold shadow-xs"
            : "text-gray-600 hover:text-gray-950 hover:bg-gray-100/70"
        }`}
      >
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            active
              ? "bg-blue-600 text-white shadow-xs shadow-blue-500/30"
              : "bg-gray-100 text-gray-500 group-hover:bg-gray-200/80 group-hover:text-gray-900"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="truncate">{item.label}</span>
        {active && (
          <div className="ml-auto w-1.5 h-5 bg-blue-600 rounded-full" />
        )}
      </Link>
    );
  };

  // The inner sidebar content shared between desktop & mobile
  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <Link
          href="/"
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-2 group"
        >
          <img
            src="/logo.png"
            alt="Logo"
            className="h-10 w-auto object-contain transition-transform group-hover:scale-102"
          />
        </Link>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center bg-gray-50 hover:bg-gray-100/80 border border-gray-200/80 rounded-xl px-3 py-2 text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent focus-within:bg-white">
          <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder={t("navbar.search", "Search opportunities...")}
            className="bg-transparent focus:outline-none w-full text-xs text-gray-900 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Navigation Links Area (Scrollable) */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-3 space-y-1">
        {/* Main Section */}
        <div className="space-y-1">
          {commonNavItems.map(renderNavLink)}
        </div>

        {/* Student Section */}
        {studentNavItems.length > 0 && (
          <div className="pt-4 mt-2">
            <div className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Student Space
            </div>
            <div className="space-y-1">
              {studentNavItems.map(renderNavLink)}
            </div>
          </div>
        )}

        {/* Admin Section */}
        {adminNavItems.length > 0 && (
          <div className="pt-4 mt-2">
            <div className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-600">
              Admin Portal
            </div>
            <div className="space-y-1">
              {adminNavItems.map(renderNavLink)}
            </div>
          </div>
        )}

        {/* Guest Admin Link */}
        {isGuest && (
          <div className="pt-3">
            <Link
              href="/adminlogin"
              onClick={() => setIsMobileOpen(false)}
              className={`group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isRouteActive("/adminlogin")
                  ? "bg-purple-50 text-purple-700 font-semibold shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span className="truncate">{t("navbar.admin", "Admin Login")}</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Bottom Utility & Auth Section */}
      <div className="border-t border-gray-200/80 p-3.5 bg-gray-50/50 space-y-3">
        {/* Language Selector */}
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-600">
            <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-700">Language</span>
          </div>
          <select
            value={i18n.language}
            onChange={handleLanguageChange}
            className="bg-transparent text-xs font-semibold text-gray-900 focus:outline-none cursor-pointer text-right"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="hi">हिन्दी</option>
            <option value="pt">Português</option>
            <option value="zh">中文</option>
            <option value="fr">Français</option>
          </select>
        </div>

        {/* Auth Section */}
        {/* 1. GUEST */}
        {isGuest && (
          <div className="space-y-2">
            <Link
              href="/login"
              onClick={() => setIsMobileOpen(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2.5 flex items-center justify-center space-x-2 text-xs font-semibold shadow-sm transition-all hover:shadow active:scale-98"
            >
              <UserIcon className="w-4 h-4 flex-shrink-0" />
              <span>Sign In / Register</span>
            </Link>

            <button
              type="button"
              onClick={handlelogin}
              disabled={isLoggingIn}
              className={`w-full bg-white hover:bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 flex items-center justify-center space-x-2.5 text-xs font-semibold text-gray-800 shadow-xs transition-all ${
                isLoggingIn ? "opacity-60 cursor-not-allowed" : "hover:border-blue-400 active:scale-98"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
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
              <span className="truncate">{t("navbar.continue", "Continue with Google")}</span>
            </button>
          </div>
        )}

        {/* 2. STUDENT */}
        {isStudent && (
          <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-xs flex items-center justify-between gap-2">
            <Link
              href="/profile"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2.5 min-w-0 flex-1 group"
            >
              <img
                src={
                  user?.photo ||
                  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces"
                }
                alt={user?.name || "User"}
                className="w-8 h-8 rounded-full border border-gray-200 object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {user?.name || "Student"}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {user?.email || "View Profile"}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={handlelogout}
              title={t("navbar.logout", "Logout")}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. ADMIN */}
        {isAdmin && (
          <div className="bg-white border border-purple-200 rounded-xl p-2.5 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse flex-shrink-0" />
              <span className="text-xs font-bold text-purple-900 truncate">
                Admin Session
              </span>
            </div>
            <button
              type="button"
              onClick={handlelogout}
              title={t("navbar.logout", "Logout")}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── MOBILE TOP BAR (md:hidden) ────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-1 text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
          </Link>
        </div>

        <div className="flex items-center space-x-2">
          {isStudent && (
            <Link href="/profile" className="flex items-center">
              <img
                src={
                  user?.photo ||
                  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces"
                }
                alt={user?.name || "User"}
                className="w-7 h-7 rounded-full border border-gray-300 object-cover"
              />
            </Link>
          )}
          {isGuest && (
            <button
              type="button"
              onClick={handlelogin}
              disabled={isLoggingIn}
              className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* ── DESKTOP FIXED SIDEBAR (hidden md:flex) ───────────────────────── */}
      <aside className="hidden md:flex fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-gray-200 z-40 flex-col shadow-xs">
        {sidebarContent}
      </aside>

      {/* ── MOBILE SLIDE-IN SIDEBAR & BACKDROP (md:hidden) ───────────────── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* ── CHROME OTP MODAL (Preserved exactly as original) ─────────────── */}
      {showChromeOtpModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 w-full max-w-[26rem] shadow-2xl border border-gray-100">
            <div className="flex items-center mb-4 space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t("loginSecurity.chromeOtpTitle")}</h2>
                <p className="text-xs text-blue-600 font-medium">Chrome Security Verification</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              {t("loginSecurity.chromeOtpDesc")}
            </p>

            {pendingLoginRef.current?.userEmail && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4 text-sm text-blue-800 font-medium truncate">
                📧 {pendingLoginRef.current.userEmail}
              </div>
            )}

            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={chromeOtpValue}
              onChange={(e) => setChromeOtpValue(e.target.value)}
              maxLength={6}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-black text-center text-xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleChromeOtpVerify();
              }}
            />

            <button
              onClick={handleChromeOtpVerify}
              disabled={chromeOtpLoading || !chromeOtpValue.trim()}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all mb-3 ${
                chromeOtpLoading || !chromeOtpValue.trim()
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-95"
              }`}
            >
              {chromeOtpLoading ? t("loginSecurity.verifying") : t("otp.verify")}
            </button>

            <button
              onClick={abortChromeLogin}
              disabled={chromeOtpLoading}
              className="w-full py-2.5 text-sm text-gray-500 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
            >
              {t("loginSecurity.cancelLogin")}
            </button>
          </div>
        </div>
      )}

      {/* ── LANGUAGE CHANGE OTP MODAL (Preserved exactly as original) ─────── */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {t("otp.title")}
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              {t("otp.description")}
            </p>

            <input
              type="email"
              placeholder={t("otp.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3 text-black"
            />

            {!otpSent ? (
              <button
                onClick={async () => {
                  if (!email) {
                    toast.error(t("otp.enterEmail"));
                    return;
                  }

                  setOtpLoading(true);

                  try {
                    const response = await fetch(`${BACKEND_URL}/api/otp/send`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    });

                    const data = await response.json();

                    if (data.success) {
                      setOtpSent(true);
                      toast.success(t("otp.sent"));
                    } else {
                      toast.error(data.message || "Failed to send OTP");
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error("Unable to connect to backend");
                  } finally {
                    setOtpLoading(false);
                  }
                }}
                className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 transition-colors"
              >
                {otpLoading ? t("otp.sending") : t("otp.send")}
              </button>
            ) : (
              <>
                <input
                  type="text"
                  placeholder={t("otp.enterOtp")}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mb-3 text-black font-mono tracking-wider"
                />

                <button
                  onClick={async () => {
                    if (!otp) {
                      toast.error(t("otp.enterOtpError"));
                      return;
                    }

                    try {
                      const response = await fetch(`${BACKEND_URL}/api/otp/verify`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, otp }),
                      });

                      const data = await response.json();

                      if (data.success) {
                        await i18n.changeLanguage(selectedLanguage);

                        setShowOtpModal(false);
                        setOtpSent(false);
                        setEmail("");
                        setOtp("");

                        toast.success(t("otp.changed"));
                      } else {
                        toast.error(data.message || "Invalid OTP");
                      }
                    } catch (error) {
                      console.error(error);
                      toast.error("Unable to verify OTP");
                    }
                  }}
                  className="w-full bg-green-600 text-white rounded-lg py-2 font-medium hover:bg-green-700 transition-colors"
                >
                  {t("otp.verify")}
                </button>
              </>
            )}

            <button
              onClick={() => {
                setShowOtpModal(false);
                setOtpSent(false);
                setEmail("");
                setOtp("");
              }}
              className="w-full mt-2 text-gray-600 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              {t("otp.cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
