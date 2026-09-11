import { selectuser } from "@/feature/userSlice";
import axios from "axios";
import { ExternalLink, Mail, User, Shield, Monitor, Smartphone, Globe, Clock } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

const BACKEND_URL = "http://localhost:5000";

interface UserInterface {
  name: string;
  email: string;
  photo: string;
}

interface LoginHistoryEntry {
  _id: string;
  browser: string;
  os: string;
  deviceType: string;
  ipAddress: string;
  loginTime: string;
  status: "success" | "failed" | "blocked" | "otp_pending" | "otp_failed";
  reason?: string;
}

const statusConfig: Record<string, { label: string; key: string; color: string; bg: string }> = {
  success:     { label: "Successful",  key: "success",     color: "text-green-700",  bg: "bg-green-100" },
  failed:      { label: "Failed",       key: "failed",      color: "text-red-700",    bg: "bg-red-100"   },
  blocked:     { label: "Blocked",      key: "blocked",     color: "text-orange-700", bg: "bg-orange-100"},
  otp_pending: { label: "OTP Pending",  key: "otpPending",  color: "text-yellow-700", bg: "bg-yellow-100"},
  otp_failed:  { label: "OTP Failed",   key: "otpFailed",   color: "text-red-700",    bg: "bg-red-100"   },
};

const ProfilePage = () => {
  const user = useSelector(selectuser);
  const { t } = useTranslation();
  const [data, setdata] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch applications
  useEffect(() => {
    const fetchdata = async () => {
      try {
        let res;
        try {
          res = await axios.get(`${BACKEND_URL}/api/application`);
        } catch {
          res = await axios.get("https://internshala-clone-y2p2.onrender.com/api/application");
        }
        setdata(res.data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchdata();
  }, []);

  // Fetch login history when user with uid is available
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.uid) return;
      setHistoryLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/login-history/${user.uid}`);
        const data = await res.json();
        if (data.success) {
          setLoginHistory(data.history || []);
        }
      } catch (err) {
        console.warn("[Profile] Could not fetch login history:", err);
        // Silently fail — no crash
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [user?.uid]);

  const userApplications = user
    ? data.filter(
        (app: any) =>
          (user.email && app.user?.email === user.email) ||
          (user.name && app.user?.name === user.name)
      )
    : [];

  const activeCount = userApplications.length;
  const acceptedCount = userApplications.filter(
    (app: any) =>
      app.status?.toLowerCase() === "accepted" ||
      app.status?.toLowerCase() === "approved"
  ).length;

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(dateStr)) + " IST";
    } catch {
      return dateStr;
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === "Mobile") return <Smartphone className="h-4 w-4 text-gray-500" />;
    return <Monitor className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* ── Profile Card ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="relative h-32 bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              {user?.photo ? (
                <img
                  src={user?.photo}
                  alt={user?.name}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                  <User className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Profile Content */}
          <div className="pt-16 pb-8 px-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
              <div className="mt-2 flex items-center justify-center text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <span className="text-blue-600 font-semibold text-2xl">
                    {activeCount}
                  </span>
                  <p className="text-blue-600 text-sm mt-1">
                    Active Applications
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <span className="text-green-600 font-semibold text-2xl">
                    {acceptedCount}
                  </span>
                  <p className="text-green-600 text-sm mt-1">
                    Accepted Applications
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-center pt-4">
                <Link
                  href="/viewapplication"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  View Applications
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Login History Card ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("loginSecurity.loginHistory")}</h2>
              <p className="text-xs text-gray-500">Last 20 login attempts</p>
            </div>
          </div>

          <div className="px-6 py-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                Loading...
              </div>
            ) : loginHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t("loginSecurity.noHistory")}</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-100">
                        <th className="pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">{t("loginSecurity.browser")}</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">{t("loginSecurity.os")}</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">{t("loginSecurity.device")}</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">{t("loginSecurity.ipAddress")}</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">{t("loginSecurity.loginTime")}</th>
                        <th className="pb-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">{t("loginSecurity.loginStatus")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loginHistory.map((entry) => {
                        const st = statusConfig[entry.status] || statusConfig.failed;
                        return (
                          <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4 text-gray-700 font-medium">{entry.browser}</td>
                            <td className="py-3 pr-4 text-gray-600">{entry.os}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center space-x-1.5 text-gray-600">
                                {getDeviceIcon(entry.deviceType)}
                                <span>{entry.deviceType}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center space-x-1 text-gray-600">
                                <Globe className="h-3.5 w-3.5 text-gray-400" />
                                <span className="font-mono text-xs">{entry.ipAddress}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center space-x-1 text-gray-600">
                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-xs">{formatDate(entry.loginTime)}</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${st.color} ${st.bg}`}>
                                {t(`loginSecurity.${st.key}`)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden space-y-3">
                  {loginHistory.map((entry) => {
                    const st = statusConfig[entry.status] || statusConfig.failed;
                    return (
                      <div key={entry._id} className="border border-gray-100 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800 text-sm">{entry.browser}</span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${st.color} ${st.bg}`}>
                            {t(`loginSecurity.${st.key}`)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            {getDeviceIcon(entry.deviceType)}
                            <span>{entry.deviceType} · {entry.os}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Globe className="h-3 w-3" />
                            <span className="font-mono">{entry.ipAddress}</span>
                          </div>
                          <div className="col-span-2 flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(entry.loginTime)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;