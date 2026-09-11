import React, { useState, useEffect } from "react";
import { Mail, KeyRound, CheckCircle, AlertCircle, Loader2, X, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";

interface OtpVerificationModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  email,
  onClose,
  onSuccess,
}) => {
  const [otp, setOtp] = useState<string>("");
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [verifyingOtp, setVerifyingOtp] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [timer, setTimer] = useState<number>(300);

  // Countdown timer for OTP expiration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpSent && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpSent, timer]);

  if (!isOpen) return null;

  const getBackendUrl = (): string => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  };

  // Helper for API calls with fallback
  const makeOtpCall = async (endpoint: string, payload: any) => {
    const urls = [
      `${getBackendUrl()}${endpoint}`,
      `https://elevance-skill.onrender.com/api${endpoint}`,
      `https://internshala-clone-y2p2.onrender.com/api${endpoint}`,
    ];

    let lastErr: any = null;
    for (const url of urls) {
      try {
        const res = await axios.post(url, payload);
        return res.data;
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr;
  };

  // Send OTP
  const handleSendOtp = async () => {
    if (!email) {
      toast.error("Student email is required for verification.");
      return;
    }

    setSendingOtp(true);
    setErrorMsg("");
    setDevOtp(null);

    try {
      const data = await makeOtpCall("/otp/send", {
        email,
        subject: "Resume Generation OTP Verification",
        text: `Your OTP for generating your Premium Resume is ${email}. This OTP is valid for 5 minutes.`,
      });

      if (data?.success) {
        setOtpSent(true);
        setTimer(300);
        if (data.devOtp) {
          setDevOtp(data.devOtp);
        }
        toast.success(`OTP sent to ${email}`);
      } else {
        setErrorMsg(data?.message || "Failed to send OTP. Please try again.");
      }
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setErrorMsg(err?.response?.data?.message || "Unable to connect to OTP service.");
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setErrorMsg("Please enter a valid OTP.");
      return;
    }

    setVerifyingOtp(true);
    setErrorMsg("");

    try {
      const data = await makeOtpCall("/otp/verify", {
        email,
        otp: otp.trim(),
      });

      if (data?.success) {
        toast.success("Identity verified successfully!");
        onSuccess();
      } else {
        setErrorMsg(data?.message || "Invalid OTP. Please try again.");
      }
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      setErrorMsg(err?.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold">Email Identity Verification</h2>
          <p className="text-xs text-blue-100 mt-1">
            Verify your email address before generating your resume.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Registered Email Display */}
          <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Verification Email</p>
              <p className="text-sm font-bold text-gray-800 truncate">{email || "No email available"}</p>
            </div>
          </div>

          {/* Dev Mode OTP Callout */}
          {devOtp && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
              <span>Test Mode OTP: <strong className="text-amber-900 text-sm font-mono tracking-widest">{devOtp}</strong></span>
              <button
                type="button"
                onClick={() => setOtp(devOtp)}
                className="text-[11px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-1 rounded"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Initial State: Send OTP Button */}
          {!otpSent ? (
            <button
              onClick={handleSendOtp}
              disabled={sendingOtp || !email}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sendingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Verification OTP...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Verification OTP
                </>
              )}
            </button>
          ) : (
            /* OTP Sent State: Input & Verify */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Enter 6-Digit OTP
                  </label>
                  <span className="text-xs font-semibold text-gray-500">
                    Expires in: <strong className="text-blue-600">{formatTimer(timer)}</strong>
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full text-center text-2xl font-mono tracking-[0.5em] py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || timer > 270}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sendingOtp ? "animate-spin" : ""}`} />
                  Resend OTP
                </button>

                <button
                  type="submit"
                  disabled={verifyingOtp || !otp}
                  className="flex-[2] py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {verifyingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Verify OTP
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtpVerificationModal;
