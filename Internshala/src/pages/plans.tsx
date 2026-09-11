import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { auth } from "@/firebase/firebase";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Check,
  Clock,
  Zap,
  Shield,
  Star,
  Crown,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface UserSubscription {
  plan: string;
  amount: number;
  maxApplications: number;
  usedApplications: number;
  remainingApplications: number;
  invoiceNumber?: string;
  startDate?: string;
  endDate?: string;
  status: string;
}

const PlansPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);

  const [loadingSubscription, setLoadingSubscription] = useState<boolean>(true);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [istTimeStr, setIstTimeStr] = useState<string>("");
  const [isWithinTimeWindow, setIsWithinTimeWindow] = useState<boolean>(false);

  // Check IST time allowed (10:00 AM - 11:00 AM IST)
  const checkISTWindow = (): boolean => {
    const now = new Date();
    const utcOffset = now.getTime() + now.getTimezoneOffset() * 60000;
    const istOffset = 5.5 * 60 * 60000;
    const ist = new Date(utcOffset + istOffset);
    const totalMinutes = ist.getHours() * 60 + ist.getMinutes();
    return totalMinutes >= 600 && totalMinutes <= 660;
  };

  const getISTTimeString = (): string => {
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }).format(new Date()) + " IST"
    );
  };

  useEffect(() => {
    const updateTime = () => {
      setIstTimeStr(getISTTimeString());
      setIsWithinTimeWindow(checkISTWindow());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dynamically load Razorpay SDK
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const getFirebaseUid = (): string => {
    return user?.uid || auth.currentUser?.uid || "";
  };

  const getUserEmail = (): string => {
    return user?.email || auth.currentUser?.email || "";
  };

  const getUserName = (): string => {
    return user?.name || auth.currentUser?.displayName || "Member";
  };

  const getBackendUrl = (): string => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  };

  const makeApiCall = async (method: "get" | "post", endpoint: string, payload?: any) => {
    const urls = [
      `${getBackendUrl()}${endpoint}`,
      `https://elevance-skill.onrender.com/api${endpoint}`,
      `https://internshala-clone-y2p2.onrender.com/api${endpoint}`,
    ];

    let lastError: any = null;
    for (const url of urls) {
      try {
        if (method === "get") {
          const res = await axios.get(url);
          return res.data;
        } else {
          const res = await axios.post(url, payload);
          return res.data;
        }
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  };

  // Fetch current user subscription status
  const fetchSubscription = async () => {
    const firebaseUid = getFirebaseUid();
    const email = getUserEmail();
    if (!firebaseUid && !email) {
      setLoadingSubscription(false);
      setCurrentSubscription(null);
      return;
    }

    try {
      const res = await makeApiCall(
        "get",
        `/payment/subscription/${firebaseUid || "guest"}?email=${encodeURIComponent(email)}`
      );
      if (res?.success && res?.data) {
        setCurrentSubscription(res.data);
      }
    } catch {
      // Default to null or free
      setCurrentSubscription({
        plan: "FREE",
        amount: 0,
        maxApplications: 1,
        usedApplications: 0,
        remainingApplications: 1,
        status: "active",
      });
    } finally {
      setLoadingSubscription(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  // Handle plan selection
  const handleSelectPlan = async (planKey: "FREE" | "BRONZE" | "SILVER" | "GOLD", price: number) => {
    const firebaseUid = getFirebaseUid();
    const email = getUserEmail();
    const name = getUserName();

    if (!firebaseUid && !email) {
      toast.error(t("plans.loginRequired"));
      return;
    }

    // If currently on this plan
    if (currentSubscription?.plan === planKey) {
      toast.info(t("plans.currentPlan"));
      return;
    }

    // Handle Free Plan selection
    if (planKey === "FREE") {
      try {
        setProcessingPlan("FREE");
        const res = await makeApiCall("post", "/payment/subscribe-free", {
          firebaseUid,
          userEmail: email,
          userName: name,
        });
        if (res?.success) {
          toast.success(t("plans.subscribed"));
          await fetchSubscription();
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Failed to switch to Free plan");
      } finally {
        setProcessingPlan(null);
      }
      return;
    }

    // Enforce Time Restriction: 10:00 AM - 11:00 AM IST
    if (!checkISTWindow()) {
      toast.error(t("plans.timeRestricted"));
      return;
    }

    setProcessingPlan(planKey);

    try {
      // Create Razorpay payment order
      const orderRes = await makeApiCall("post", "/payment/create-order", {
        amount: price,
        firebaseUid,
        userEmail: email,
        userName: name,
        purpose: "subscription",
        plan: planKey,
      });

      if (!orderRes || !orderRes.success) {
        toast.error(orderRes?.error || "Failed to initiate payment");
        setProcessingPlan(null);
        return;
      }

      const { keyId, isMock, order } = orderRes;

      if (!isMock && typeof window !== "undefined" && (window as any).Razorpay) {
        const options = {
          key: keyId,
          amount: order.amount,
          currency: order.currency || "INR",
          name: "InternArea Subscriptions",
          description: `${planKey} Subscription Plan - ₹${price}/month`,
          order_id: order.id,
          prefill: {
            name: name,
            email: email,
          },
          theme: {
            color: planKey === "GOLD" ? "#D97706" : planKey === "SILVER" ? "#2563EB" : "#CD7F32",
          },
          handler: async (response: any) => {
            try {
              const verifyRes = await makeApiCall("post", "/payment/verify-signature", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                firebaseUid,
                userEmail: email,
                userName: name,
                purpose: "subscription",
                plan: planKey,
                amount: price,
              });

              if (verifyRes?.success) {
                toast.success(t("plans.paymentSuccess"));
                await fetchSubscription();
              } else {
                toast.error(verifyRes?.error || "Payment signature verification failed");
              }
            } catch (err: any) {
              console.error("Signature verification error:", err);
              toast.error(err?.response?.data?.error || "Error verifying payment signature");
            } finally {
              setProcessingPlan(null);
            }
          },
          modal: {
            ondismiss: () => {
              setProcessingPlan(null);
              toast.info("Payment cancelled.");
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (resp: any) => {
          setProcessingPlan(null);
          toast.error(resp?.error?.description || "Payment failed");
        });
        rzp.open();
      } else {
        // Dev/Mock mode verification
        const verifyRes = await makeApiCall("post", "/payment/verify-signature", {
          razorpay_order_id: order.id,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: "mock_test_signature",
          firebaseUid,
          userEmail: email,
          userName: name,
          purpose: "subscription",
          plan: planKey,
          amount: price,
        });

        if (verifyRes?.success) {
          toast.success(t("plans.paymentSuccess"));
          await fetchSubscription();
        } else {
          toast.error(verifyRes?.error || "Payment verification failed");
        }
        setProcessingPlan(null);
      }
    } catch (err: any) {
      console.error("Subscription payment error:", err);
      const errMsg =
        err?.response?.data?.error ||
        (!checkISTWindow() ? t("plans.timeRestricted") : "Failed to process subscription");
      toast.error(errMsg);
      setProcessingPlan(null);
    }
  };

  const plans = [
    {
      key: "FREE" as const,
      name: t("plans.free"),
      price: 0,
      applications: 1,
      unlimited: false,
      description: t("plans.freeDesc"),
      icon: <Shield className="w-8 h-8 text-gray-500" />,
      features: [
        `1 ${t("plans.applicationsPerMonth")}`,
        "Standard applicant ranking",
        "Email notifications",
        "Basic resume access",
      ],
      badge: null,
      borderStyle: "border-gray-200",
      accentBg: "bg-gray-50",
      buttonColor: "bg-gray-800 hover:bg-gray-900 text-white",
    },
    {
      key: "BRONZE" as const,
      name: t("plans.bronze"),
      price: 100,
      applications: 3,
      unlimited: false,
      description: t("plans.bronzeDesc"),
      icon: <Zap className="w-8 h-8 text-amber-700" />,
      features: [
        `3 ${t("plans.applicationsPerMonth")}`,
        "Priority application badge",
        "Direct recruiter view status",
        "Instant application notifications",
      ],
      badge: null,
      borderStyle: "border-amber-300",
      accentBg: "bg-amber-50/50",
      buttonColor: "bg-amber-700 hover:bg-amber-800 text-white",
    },
    {
      key: "SILVER" as const,
      name: t("plans.silver"),
      price: 300,
      applications: 5,
      unlimited: false,
      description: t("plans.silverDesc"),
      icon: <Star className="w-8 h-8 text-blue-600" />,
      features: [
        `5 ${t("plans.applicationsPerMonth")}`,
        "Featured applicant placement",
        "Skill match insights",
        "Weekly opportunity alerts",
        "Dedicated applicant support",
      ],
      badge: t("plans.recommended"),
      borderStyle: "border-blue-500 ring-2 ring-blue-500/20 shadow-xl",
      accentBg: "bg-blue-50/40",
      buttonColor: "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg",
    },
    {
      key: "GOLD" as const,
      name: t("plans.gold"),
      price: 1000,
      applications: -1,
      unlimited: true,
      description: t("plans.goldDesc"),
      icon: <Crown className="w-8 h-8 text-yellow-500" />,
      features: [
        t("plans.unlimitedApplications"),
        "Top-of-inbox recruiter spotlight",
        "Full resume analytics",
        "Direct application tracking",
        "24/7 VIP career concierge",
      ],
      badge: null,
      borderStyle: "border-yellow-400 shadow-lg",
      accentBg: "bg-yellow-50/40",
      buttonColor: "bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white",
    },
  ];

  return (
    <>
      <Head>
        <title>{t("plans.title")} | InternArea</title>
        <meta
          name="description"
          content="Choose from our flexible internship application subscription plans: Free, Bronze, Silver, and Gold."
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles className="w-4 h-4" />
              <span>{t("plans.title")}</span>
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
              {t("plans.title")}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t("plans.subtitle")}
            </p>

            {/* Time Window Notice Banner */}
            <div
              className={`mt-6 inline-flex items-center space-x-3 px-4 py-3 rounded-xl border text-sm transition-all ${
                isWithinTimeWindow
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
            >
              <Clock className={`w-5 h-5 flex-shrink-0 ${isWithinTimeWindow ? "text-emerald-600" : "text-amber-600"}`} />
              <div className="text-left">
                <p className="font-medium">
                  {t("plans.timeNotice")}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  Current Time: <span className="font-semibold">{istTimeStr || "Calculating..."}</span>
                  {isWithinTimeWindow ? (
                    <span className="ml-2 font-bold text-emerald-700">● Window Open</span>
                  ) : (
                    <span className="ml-2 font-bold text-amber-700">○ Outside Window (10:00 AM - 11:00 AM IST)</span>
                  )}
                </p>
              </div>
            </div>

            {/* Active Subscription Banner if user has one */}
            {currentSubscription && (
              <div className="mt-4 inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg text-xs text-blue-900">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span>
                  {t("plans.currentPlan")}: <strong>{currentSubscription.plan}</strong>
                  {currentSubscription.maxApplications === -1 ? (
                    ` (${t("plans.unlimited")})`
                  ) : (
                    ` (${currentSubscription.remainingApplications} ${t("plans.applicationsLeft")})`
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch">
            {plans.map((plan) => {
              const isCurrent = currentSubscription?.plan === plan.key;
              const isProcessing = processingPlan === plan.key;

              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col justify-between rounded-2xl bg-white border p-6 sm:p-8 transition-all duration-200 hover:-translate-y-1 ${
                    plan.borderStyle
                  } ${isCurrent ? "ring-2 ring-emerald-500 border-emerald-500" : ""}`}
                >
                  {/* Recommended Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Current Plan Indicator */}
                  {isCurrent && (
                    <div className="absolute -top-3.5 right-4">
                      <span className="bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>{t("plans.currentPlan")}</span>
                      </span>
                    </div>
                  )}

                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl ${plan.accentBg}`}>
                        {plan.icon}
                      </div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {plan.key}
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="mt-1 text-sm text-gray-500 min-h-[40px]">
                      {plan.description}
                    </p>

                    {/* Price */}
                    <div className="mt-6 mb-6">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-extrabold text-gray-900">
                          ₹{plan.price}
                        </span>
                        <span className="ml-1 text-sm font-medium text-gray-500">
                          {t("plans.monthly")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-blue-600">
                        {plan.unlimited
                          ? t("plans.unlimitedApplications")
                          : `${plan.applications} ${t("plans.applicationsPerMonth")}`}
                      </p>
                    </div>

                    {/* Feature List */}
                    <div className="border-t border-gray-100 pt-6">
                      <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">
                        {t("plans.features")}
                      </p>
                      <ul className="space-y-3 text-sm text-gray-600">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <Check className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-8 pt-4">
                    <button
                      type="button"
                      disabled={isCurrent || isProcessing}
                      onClick={() => handleSelectPlan(plan.key, plan.price)}
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center space-x-2 ${
                        isCurrent
                          ? "bg-emerald-100 text-emerald-800 cursor-default border border-emerald-300"
                          : `${plan.buttonColor} disabled:opacity-50 disabled:cursor-not-allowed`
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          <span>Processing...</span>
                        </>
                      ) : isCurrent ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{t("plans.currentPlan")}</span>
                        </>
                      ) : (
                        <span>{t("plans.choosePlan")}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Security / Notice Footer */}
          <div className="mt-16 text-center border-t border-gray-200 pt-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Secure Payments via Razorpay</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>10:00 - 11:00 AM IST Window</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-purple-600" />
                <span>Instant Invoicing</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              All subscription plans are billed monthly. Need assistance? Reach out to support.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PlansPage;
