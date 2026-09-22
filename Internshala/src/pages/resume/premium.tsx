import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { auth } from "@/firebase/firebase";
import { useRouter } from "next/router";
import axios from "axios";
import { API_URL } from "@/config/api";
import { toast } from "react-toastify";
import {
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  FileText,
  Send,
  Lock,
  ArrowRight,
  Loader2,
  Award,
  Crown,
  CreditCard,
} from "lucide-react";
import OtpVerificationModal from "@/components/OtpVerificationModal";

const ResumePremiumPage: React.FC = () => {
  const user = useSelector(selectuser);
  const router = useRouter();

  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);

  const getFirebaseUid = (): string => {
    return user?.uid || auth.currentUser?.uid || "";
  };

  const makeApiCall = async (method: "get" | "post", endpoint: string, payload?: any) => {
    const url = `${API_URL}${endpoint}`;
    if (method === "get") {
      const res = await axios.get(url);
      return res.data;
    } else {
      const res = await axios.post(url, payload);
      return res.data;
    }
  };

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

  // Check if user has Premium Membership (isPremium === true)
  useEffect(() => {
    const checkPremiumStatus = async () => {
      const firebaseUid = getFirebaseUid();
      if (!firebaseUid) {
        setLoadingStatus(false);
        return;
      }

      try {
        const resumeData = await makeApiCall("get", `/resume/${firebaseUid}`);
        if (resumeData && (resumeData.isPremium || resumeData.paymentStatus)) {
          setIsPremium(true);
          // If already a premium member, immediately redirect to builder
          router.replace("/resume/builder");
          return;
        }
      } catch (err: any) {
        // Unpaid or new user
      } finally {
        setLoadingStatus(false);
      }
    };

    checkPremiumStatus();
  }, [user]);

  // Step 1: User Clicks "Become Premium - ₹300"
  const handleUpgradeClick = async () => {
    const firebaseUid = getFirebaseUid();

    if (!user && !auth.currentUser) {
      toast.error("Please log in using Google / Firebase to upgrade to Premium.");
      return;
    }

    const email = user?.email || auth.currentUser?.email || "";
    if (!email) {
      toast.error("User email is required. Please check your login session.");
      return;
    }

    // Ensure a base draft document exists in MongoDB for UID
    try {
      if (firebaseUid) {
        await makeApiCall("post", "/resume", {
          firebaseUid,
          name: user?.name || auth.currentUser?.displayName || "Student",
          email: email,
          photo: user?.photo || auth.currentUser?.photoURL || "",
        });
      }
    } catch {
      // ignore draft creation errors
    }

    if (!isVerified) {
      setShowOtpModal(true);
    } else {
      handleInitiatePayment();
    }
  };

  // Step 2: OTP Verification Success Callback
  const handleOtpSuccess = () => {
    setIsVerified(true);
    setShowOtpModal(false);
    toast.success("Email identity verified! Opening Razorpay payment...");
    handleInitiatePayment();
  };

  // Step 3: Razorpay Payment Checkout for ₹300 Premium Membership
  const handleInitiatePayment = async () => {
    const firebaseUid = getFirebaseUid();
    if (!firebaseUid) {
      toast.error("Please log in to proceed with payment.");
      return;
    }

    setProcessingPayment(true);

    try {
      const orderRes = await makeApiCall("post", "/payment/create-order", {
        amount: 300,
        firebaseUid,
        purpose: "premium_membership",
      });

      if (!orderRes || !orderRes.success) {
        toast.error("Failed to create Razorpay payment order.");
        setProcessingPayment(false);
        return;
      }

      const { keyId, isMock, order } = orderRes;

      if (!isMock && typeof window !== "undefined" && (window as any).Razorpay) {
        const options = {
          key: keyId,
          amount: order.amount,
          currency: order.currency || "INR",
          name: "Premium Membership",
          description: "₹300 Premium Resume Builder Access",
          order_id: order.id,
          prefill: {
            name: user?.name || auth.currentUser?.displayName || "",
            email: user?.email || auth.currentUser?.email || "",
          },
          theme: {
            color: "#2563EB",
          },
          handler: async (response: any) => {
            try {
              const verifyRes = await makeApiCall("post", "/payment/verify-signature", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                firebaseUid,
                purpose: "premium_membership",
              });

              if (verifyRes?.success) {
                setIsPremium(true);
                toast.success("🎉 ₹300 Premium Membership Activated! Welcome to Resume Builder!");
                router.push("/resume/builder");
              } else {
                toast.error(verifyRes?.error || "Payment signature verification failed.");
              }
            } catch (err: any) {
              console.error("Payment verification error:", err);
              toast.error("Error verifying payment signature.");
            } finally {
              setProcessingPayment(false);
            }
          },
          modal: {
            ondismiss: () => {
              setProcessingPayment(false);
              toast.info("Payment cancelled.");
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Dev Mode Fallback if Razorpay keys are mock or not configured
        toast.info("Dev Mode: Auto-verifying test payment of ₹300...");

        const verifyRes = await makeApiCall("post", "/payment/verify-signature", {
          razorpay_order_id: order.id,
          razorpay_payment_id: `pay_dev_premium_${Date.now()}`,
          razorpay_signature: "mock_test_signature",
          firebaseUid,
          purpose: "premium_membership",
        });

        if (verifyRes?.success) {
          setIsPremium(true);
          toast.success("🎉 Test Mode: ₹300 Premium Membership Unlocked! Opening Builder...");
          router.push("/resume/builder");
        } else {
          toast.error("Test payment verification failed.");
        }
        setProcessingPayment(false);
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error("Unable to initiate Razorpay payment.");
      setProcessingPayment(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Checking Membership Status...</p>
        </div>
      </div>
    );
  }

  const userEmail = user?.email || auth.currentUser?.email || "";

  return (
    <div className="min-h-screen bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[300px] bg-indigo-600/20 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider shadow-inner">
            <Crown className="w-4 h-4 text-amber-400" />
            Premium Membership Access
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Unlock the Ultimate <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">Resume Builder</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Become a Premium Member for ₹300 to get full access to create, edit, save drafts, and live-preview your resume across Modern, Classic, and Minimalist templates.
          </p>

          {/* Primary CTA */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleUpgradeClick}
              disabled={processingPayment}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-extrabold text-lg rounded-2xl shadow-xl hover:shadow-blue-500/25 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {processingPayment ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  Become Premium - ₹300
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400">Unlock Resume Builder • Unlimited Draft Saving • Live Template Previews</p>
        </div>

        {/* PRICING & BENEFIT CARDS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-stretch">
          {/* Benefits Card */}
          <div className="lg:col-span-2 bg-slate-800/80 backdrop-blur-md rounded-3xl p-8 border border-slate-700/80 shadow-2xl flex flex-col justify-between space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                <Award className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">Premium Membership Benefits</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 flex-shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Unlock Resume Builder</h3>
                    <p className="text-slate-400 text-xs mt-1">
                      Access the complete interactive resume editor for personal details, education, experience, projects & skills.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 flex-shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Live Template Previews</h3>
                    <p className="text-slate-400 text-xs mt-1">
                      Switch seamlessly between Modern, Classic, and Minimalist templates with instant visual rendering.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex-shrink-0">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Unlimited Draft Saving</h3>
                    <p className="text-slate-400 text-xs mt-1">
                      Edit and update your resume draft anytime in MongoDB without restrictions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 flex-shrink-0">
                    <Crown className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Future Premium Features</h3>
                    <p className="text-slate-400 text-xs mt-1">
                      Get instant access to upcoming recruiter tools and profile enhancements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified Email Identity via OTP</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <span>Encrypted Razorpay Checkout</span>
              </div>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-gradient-to-b from-blue-900/40 via-slate-800 to-slate-900 rounded-3xl p-8 border-2 border-blue-500/50 shadow-2xl flex flex-col justify-between space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
              Membership
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">Premium Membership</h3>
              <p className="text-xs text-slate-300">
                Unlock full access to the interactive Resume Builder.
              </p>

              <div className="pt-2 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-white">₹300</span>
                <span className="text-slate-400 text-sm line-through">₹999</span>
                <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  SAVE 70%
                </span>
              </div>

              <ul className="space-y-3 pt-4 border-t border-slate-700/80 text-xs text-slate-200">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Unlock Interactive Resume Builder</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Unlimited Resume Editing & Updating</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Resume Draft Auto-Saving</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Live Modern, Classic & Minimal Previews</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Future Premium Upgrades Included</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleUpgradeClick}
              disabled={processingPayment}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Become Premium - ₹300
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-700/50 text-center text-xs text-slate-400 max-w-3xl mx-auto space-y-2">
          <p className="font-bold text-slate-300 text-sm">Secure Payment Guarantee</p>
          <p>
            Payments are processed securely via Razorpay. Paying ₹300 unlocks permanent access to the Resume Builder. Generating and downloading PDF resumes requires a separate ₹50 fee inside the builder.
          </p>
        </div>
      </div>

      {/* OTP Verification Modal */}
      <OtpVerificationModal
        isOpen={showOtpModal}
        email={userEmail}
        onClose={() => setShowOtpModal(false)}
        onSuccess={handleOtpSuccess}
      />
    </div>
  );
};

export default ResumePremiumPage;
