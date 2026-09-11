import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { auth } from "@/firebase/firebase";
import axios from "axios";
import { toast } from "react-toastify";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  Plus,
  Trash2,
  Save,
  BookOpen,
  Briefcase,
  Code,
  Award,
  Upload,
  CheckCircle,
  Loader2,
  Eye,
  Edit3,
  Columns,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Check,
  Download,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/router";
import ResumePreview, { TemplateType } from "@/components/ResumePreview";
import OtpVerificationModal from "@/components/OtpVerificationModal";

interface EducationItem {
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
  cgpa: string;
}

interface ExperienceItem {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface ProjectItem {
  title: string;
  description: string;
  technologies: string[];
  techInput?: string;
  github: string;
  liveLink: string;
}

interface CertificationItem {
  title: string;
  organization: string;
  year: string;
}

const ResumeBuilder: React.FC = () => {
  const user = useSelector(selectuser);
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  // 'checking' = still determining | 'yes' = premium | 'no' = not premium
  const [premiumStatus, setPremiumStatus] = useState<'checking' | 'yes' | 'no'>('checking');
  // Guard so the fetch runs exactly once regardless of how many times user ref changes
  const hasFetchedRef = useRef(false);
  const [saving, setSaving] = useState<boolean>(false);

  // View mode tab state: "edit" | "preview" | "split"
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("Modern");

  // OTP Verification, Payment & PDF Generation State
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [paymentCompleted, setPaymentCompleted] = useState<boolean>(false);
  const [activePaymentId, setActivePaymentId] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);

  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [resumeUrl, setResumeUrl] = useState<string>("");

  // Form State
  const [personalInfo, setPersonalInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    linkedin: "",
    github: "",
    portfolio: "",
    summary: "",
    photo: "",
  });

  const [education, setEducation] = useState<EducationItem[]>([
    { institution: "", degree: "", field: "", startYear: "", endYear: "", cgpa: "" },
  ]);

  const [experience, setExperience] = useState<ExperienceItem[]>([
    { company: "", role: "", startDate: "", endDate: "", description: "" },
  ]);

  const [projects, setProjects] = useState<ProjectItem[]>([
    { title: "", description: "", technologies: [], techInput: "", github: "", liveLink: "" },
  ]);

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState<string>("");

  const [certifications, setCertifications] = useState<CertificationItem[]>([
    { title: "", organization: "", year: "" },
  ]);

  const [achievements, setAchievements] = useState<string[]>([]);
  const [achievementInput, setAchievementInput] = useState<string>("");

  // Get active firebase UID
  const getFirebaseUid = (): string => {
    return user?.uid || auth.currentUser?.uid || "";
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

  // Load Razorpay Script dynamically
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

  // Auto-populate resume data on load & enforce strict Premium access control.
  // IMPORTANT: hasFetchedRef ensures this runs exactly ONCE, preventing repeated
  // toasts and API calls caused by the user object reference changing on re-renders.
  useEffect(() => {
    // If we already fetched, do nothing — even if user reference changes.
    if (hasFetchedRef.current) return;

    // Wait until we know whether a user is logged in.
    // On first mount user may be null while Redux hydrates; we wait one tick.
    // If user is genuinely null after that, show the non-premium screen.
    const runFetch = async () => {
      hasFetchedRef.current = true; // Set BEFORE async work so no second call races in

      const firebaseUid = getFirebaseUid();

      // Pre-populate name/email from Redux if available
      if (user?.name || user?.email) {
        setPersonalInfo((prev) => ({
          ...prev,
          name: prev.name || user.name || "",
          email: prev.email || user.email || "",
          photo: prev.photo || user.photo || "",
        }));
      }

      if (!firebaseUid) {
        // Not logged in at all — show upgrade UI (not a loop; hasFetchedRef prevents re-run)
        setPremiumStatus('no');
        setLoading(false);
        return;
      }

      try {
        const data = await makeApiCall("get", `/resume/${firebaseUid}`);

        // Access Control Guard: Only paid Premium members can use Resume Builder
        if (data && data.isPremium) {
          setPersonalInfo({
            name: data.name || user?.name || "",
            email: data.email || user?.email || "",
            phone: data.phone || "",
            address: data.address || "",
            linkedin: data.linkedin || "",
            github: data.github || "",
            portfolio: data.portfolio || "",
            summary: data.summary || "",
            photo: data.photo || user?.photo || "",
          });

          if (data.selectedTemplate) {
            setSelectedTemplate(data.selectedTemplate as TemplateType);
          }

          // Each PDF generation requires its own ₹50 payment — reset here
          setPaymentCompleted(false);
          setIsVerified(true);

          if (data.resumeUrl) {
            setResumeUrl(data.resumeUrl);
          } else {
            setResumeUrl("");
          }

          if (data.education && data.education.length > 0) setEducation(data.education);
          if (data.experience && data.experience.length > 0) setExperience(data.experience);
          if (data.projects && data.projects.length > 0) {
            setProjects(
              data.projects.map((p: any) => ({
                ...p,
                techInput: Array.isArray(p.technologies) ? p.technologies.join(", ") : "",
              }))
            );
          }
          if (data.skills && Array.isArray(data.skills)) setSkills(data.skills);
          if (data.certifications && data.certifications.length > 0) setCertifications(data.certifications);
          if (data.achievements && Array.isArray(data.achievements)) setAchievements(data.achievements);

          setPremiumStatus('yes');
        } else {
          // API responded but isPremium is false — show upgrade UI, no toast spam
          setPremiumStatus('no');
        }
      } catch (err: any) {
        // API error (user not found / network error) — treat as non-premium, show upgrade UI
        console.warn("[ResumeBuilder] Could not fetch resume data:", err?.message || err);
        setPremiumStatus('no');
      } finally {
        setLoading(false);
      }
    };

    runFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — hasFetchedRef.current prevents any accidental double-run

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Photo size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPersonalInfo((prev) => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Education Helpers
  const addEducation = () => {
    setEducation([...education, { institution: "", degree: "", field: "", startYear: "", endYear: "", cgpa: "" }]);
  };
  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };
  const updateEducation = (index: number, field: keyof EducationItem, value: string) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  // Experience Helpers
  const addExperience = () => {
    setExperience([...experience, { company: "", role: "", startDate: "", endDate: "", description: "" }]);
  };
  const removeExperience = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };
  const updateExperience = (index: number, field: keyof ExperienceItem, value: string) => {
    const updated = [...experience];
    updated[index][field] = value;
    setExperience(updated);
  };

  // Project Helpers
  const addProject = () => {
    setProjects([...projects, { title: "", description: "", technologies: [], techInput: "", github: "", liveLink: "" }]);
  };
  const removeProject = (index: number) => {
    setProjects(projects.filter((_, i) => i !== index));
  };
  const updateProject = (index: number, field: keyof ProjectItem, value: string) => {
    const updated = [...projects];
    if (field === "techInput") {
      updated[index].techInput = value;
      updated[index].technologies = value.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      (updated[index] as any)[field] = value;
    }
    setProjects(updated);
  };

  // Skills Helpers
  const addSkill = () => {
    if (skillInput.trim()) {
      const newSkills = skillInput.split(",").map((s) => s.trim()).filter((s) => s && !skills.includes(s));
      setSkills([...skills, ...newSkills]);
      setSkillInput("");
    }
  };
  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Certification Helpers
  const addCertification = () => {
    setCertifications([...certifications, { title: "", organization: "", year: "" }]);
  };
  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };
  const updateCertification = (index: number, field: keyof CertificationItem, value: string) => {
    const updated = [...certifications];
    updated[index][field] = value;
    setCertifications(updated);
  };

  // Achievements Helpers
  const addAchievement = () => {
    if (achievementInput.trim()) {
      setAchievements([...achievements, achievementInput.trim()]);
      setAchievementInput("");
    }
  };
  const removeAchievement = (index: number) => {
    setAchievements(achievements.filter((_, i) => i !== index));
  };

  // Save / Update Resume
  const saveResumeDraft = async (): Promise<boolean> => {
    const firebaseUid = getFirebaseUid();

    if (!firebaseUid) {
      toast.error("Please log in using Firebase to save your resume draft.");
      return false;
    }

    if (!personalInfo.name.trim() || !personalInfo.email.trim()) {
      toast.error("Name and Email are required fields.");
      return false;
    }

    setSaving(true);

    const payload = {
      firebaseUid,
      ...personalInfo,
      selectedTemplate,
      education,
      experience,
      projects: projects.map(({ techInput, ...rest }) => rest),
      skills,
      certifications,
      achievements,
    };

    try {
      await makeApiCall("post", "/resume", payload);
      toast.success("Resume draft saved successfully!");
      return true;
    } catch (err: any) {
      console.error("Save resume error:", err);
      toast.error("Failed to save resume draft. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Draft (Free for Premium Members)
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await saveResumeDraft();
  };

  const handleOtpSuccess = () => {
    setIsVerified(true);
    setShowOtpModal(false);
    toast.success("Identity verified successfully!");
  };

  // Handle "Generate & Download PDF - ₹50" Button Click
  const handleGenerateClick = async () => {
    if (!personalInfo.email.trim()) {
      toast.error("Please enter a valid email address first.");
      return;
    }

    if (processingPayment || generatingPdf) return;

    const saved = await saveResumeDraft();
    if (saved) {
      // Business Rule: Every resume/PDF generation requires a separate ₹50 payment
      handleInitiatePayment();
    }
  };

  // Handle Razorpay Payment Flow for ₹50 PDF Generation
  const handleInitiatePayment = async () => {
    const firebaseUid = getFirebaseUid();
    if (!firebaseUid) {
      toast.error("Please log in to proceed with payment.");
      return;
    }

    if (processingPayment) return;
    setProcessingPayment(true);

    try {
      console.log("[FRONTEND PAYMENT DEBUG] Creating ₹50 PDF order for UID:", firebaseUid);
      const orderRes = await makeApiCall("post", "/payment/create-order", {
        amount: 50,
        firebaseUid,
        purpose: "pdf_generation",
      });

      console.log("[FRONTEND PAYMENT DEBUG] Create order API response:", orderRes);

      if (!orderRes || !orderRes.success) {
        toast.error("Failed to create Razorpay payment order.");
        setProcessingPayment(false);
        return;
      }

      const { keyId, isMock, order } = orderRes;

      if (!isMock && typeof window !== "undefined" && (window as any).Razorpay) {
        console.log("[FRONTEND PAYMENT DEBUG] Opening Real Razorpay Checkout Modal for ₹50 PDF");

        const options = {
          key: keyId,
          amount: order.amount,
          currency: order.currency || "INR",
          name: "Resume PDF Generation",
          description: "₹50 Professional Resume PDF Download Fee",
          order_id: order.id,
          prefill: {
            name: personalInfo.name,
            email: personalInfo.email,
            contact: personalInfo.phone,
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
                purpose: "pdf_generation",
              });

              if (verifyRes?.success) {
                toast.success("Payment of ₹50 verified successfully! Generating PDF...");
                await handleGeneratePdf(response.razorpay_payment_id);
              } else {
                toast.error(verifyRes?.error || "Payment signature verification failed.");
              }
            } catch (err: any) {
              console.error("[FRONTEND PAYMENT DEBUG] Payment verification error:", err);
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
        // Dev Mode Fallback for ₹50 PDF payment
        toast.info("Dev Mode: Verifying test payment of ₹50...");

        const devPaymentId = `pay_dev_pdf_${Date.now()}`;
        const verifyRes = await makeApiCall("post", "/payment/verify-signature", {
          razorpay_order_id: order.id,
          razorpay_payment_id: devPaymentId,
          razorpay_signature: "mock_test_signature",
          firebaseUid,
          purpose: "pdf_generation",
        });

        if (verifyRes?.success) {
          toast.success("Test Mode: Payment of ₹50 verified! Generating PDF...");
          await handleGeneratePdf(verifyRes.paymentId || devPaymentId);
        } else {
          toast.error("Test payment verification failed.");
        }
        setProcessingPayment(false);
      }
    } catch (err: any) {
      console.error("[FRONTEND PAYMENT DEBUG] Payment error:", err);
      toast.error("Unable to initiate Razorpay payment.");
      setProcessingPayment(false);
    }
  };

  // Generate & Upload PDF Resume with verified paymentId
  const handleGeneratePdf = async (paidPaymentId?: any) => {
    const firebaseUid = getFirebaseUid();
    if (!firebaseUid) {
      toast.error("Please log in to generate your PDF resume.");
      return;
    }

    const paymentIdToUse = typeof paidPaymentId === "string" ? paidPaymentId : activePaymentId;

    if (generatingPdf) return;
    setGeneratingPdf(true);

    try {
      const res = await makeApiCall("post", "/resume/generate-pdf", {
        firebaseUid,
        paymentId: paymentIdToUse,
      });

      if (res?.success && res?.resumeUrl) {
        setResumeUrl(res.resumeUrl);
        setPaymentCompleted(false);
        setActivePaymentId("");
        toast.success("Professional PDF resume generated successfully!");
        // Open PDF in new tab
        window.open(res.resumeUrl, "_blank");
      } else {
        toast.error(res?.error || "Failed to generate PDF resume.");
      }
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast.error(err?.response?.data?.error || "Error generating PDF resume.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const previewData = {
    ...personalInfo,
    education,
    experience,
    projects: projects.map(({ techInput, ...rest }) => rest),
    skills,
    certifications,
    achievements,
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading || premiumStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your resume draft...</p>
        </div>
      </div>
    );
  }

  // ── Non-premium upgrade screen ─────────────────────────────────────────────
  // Shown ONCE when the user is not a premium member. No toast, no redirect loop.
  if (premiumStatus === 'no') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Resume Builder</h1>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">
            Premium membership required
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-8">
            Resume Builder is available to Premium members. Upgrade your membership to
            create, customize, and download your professional resume.
          </p>
          <button
            type="button"
            onClick={() => router.push("/plans")}
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow transition-colors duration-150"
          >
            <Sparkles className="w-4 h-4" />
            View Plans
          </button>
          <p className="mt-4 text-xs text-gray-400">
            PDF generation (₹50) is a separate one-time fee, charged only when you download a PDF.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Resume Builder</h1>
            <p className="text-gray-500 text-sm mt-1">
              Create, customize, and live-preview your premium resume templates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle Buttons */}
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={`flex items-center px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  viewMode === "edit"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                Edit Form
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`flex items-center px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  viewMode === "preview"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`hidden xl:flex items-center px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  viewMode === "split"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Columns className="w-3.5 h-3.5 mr-1.5" />
                Split View
              </button>
            </div>

            {/* Save Draft Button */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-semibold text-sm rounded-lg shadow transition-colors duration-200 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="-ml-1 mr-2 h-4 w-4" />
                  Save Draft
                </>
              )}
            </button>

            {/* Action State Buttons: Unverified -> Verified -> Paid -> PDF Generated */}
            {paymentCompleted ? (
              <button
                type="button"
                onClick={() => handleGeneratePdf()}
                disabled={generatingPdf}
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="-ml-1 mr-2 h-4 w-4" />
                    {resumeUrl ? "Re-Generate PDF Resume" : "Generate & Download PDF"}
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={processingPayment}
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-lg shadow-lg transition-all duration-200"
              >
                <Sparkles className="-ml-1 mr-2 h-4 w-4" />
                Generate PDF - ₹50
              </button>
            )}
          </div>
        </div>

        {/* Generated Resume Success Banner if URL exists & ₹50 payment completed */}
        {paymentCompleted && resumeUrl ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-emerald-800">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Your Premium PDF Resume is Ready!</p>
                <p className="text-xs text-emerald-700">
                  Attached to your profile. Automatically linked when applying for internships.
                </p>
              </div>
            </div>
            <a
              href={resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              View / Download PDF Resume
            </a>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-amber-900">
              <FileText className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">No PDF has been generated yet.</p>
                <p className="text-xs text-amber-700">
                  You can edit your details, save drafts, and preview templates. Click &quot;Generate PDF - ₹50&quot; to generate and download your PDF resume.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={processingPayment}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg shadow transition-colors flex-shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Generate PDF - ₹50
            </button>
          </div>
        )}

        {/* Dynamic View Area: Form / Preview / Split */}
        <div
          className={
            viewMode === "split"
              ? "grid grid-cols-1 xl:grid-cols-2 gap-8 items-start"
              : "w-full"
          }
        >
          {/* EDIT FORM COLUMN */}
          {(viewMode === "edit" || viewMode === "split") && (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section 1: Personal Information */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
                  <User className="h-6 w-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Photo Upload & Preview */}
                  <div className="md:col-span-2 flex flex-col sm:flex-row items-center gap-6 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                    <div className="relative">
                      {personalInfo.photo ? (
                        <img
                          src={personalInfo.photo}
                          alt="Profile"
                          className="w-24 h-24 rounded-full object-cover border-4 border-white shadow"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow">
                          <User className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Profile Photo</label>
                      <p className="text-xs text-gray-500 mb-3">Upload a professional JPG or PNG (max 2MB)</p>
                      <label className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md font-medium text-xs text-gray-700 hover:bg-gray-50 cursor-pointer shadow-sm">
                        <Upload className="w-4 h-4 mr-2 text-gray-500" />
                        Choose File
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={personalInfo.name}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                      placeholder="e.g. john@example.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Location / Address</label>
                    <input
                      type="text"
                      value={personalInfo.address}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, address: e.target.value })}
                      placeholder="e.g. Mumbai, India"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">LinkedIn Profile</label>
                    <input
                      type="url"
                      value={personalInfo.linkedin}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, linkedin: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">GitHub Profile</label>
                    <input
                      type="url"
                      value={personalInfo.github}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, github: e.target.value })}
                      placeholder="https://github.com/username"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Portfolio / Website</label>
                    <input
                      type="url"
                      value={personalInfo.portfolio}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, portfolio: e.target.value })}
                      placeholder="https://myportfolio.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Professional Summary</label>
                    <textarea
                      rows={3}
                      value={personalInfo.summary}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, summary: e.target.value })}
                      placeholder="Brief summary of your professional background, goals, and key strengths..."
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Education */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-900">Education</h2>
                  </div>
                  <button
                    type="button"
                    onClick={addEducation}
                    className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Education
                  </button>
                </div>

                <div className="space-y-6">
                  {education.map((edu, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-gray-50 border border-gray-200 relative group">
                      {education.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEducation(idx)}
                          className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1"
                          title="Remove Education"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Institution / University</label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                            placeholder="e.g. ABC Institute of Technology"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Degree</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                            placeholder="e.g. Bachelor of Technology"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Field of Study</label>
                          <input
                            type="text"
                            value={edu.field}
                            onChange={(e) => updateEducation(idx, "field", e.target.value)}
                            placeholder="e.g. Computer Science"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">CGPA / Percentage</label>
                          <input
                            type="text"
                            value={edu.cgpa}
                            onChange={(e) => updateEducation(idx, "cgpa", e.target.value)}
                            placeholder="e.g. 8.5 / 10"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Start Year</label>
                          <input
                            type="text"
                            value={edu.startYear}
                            onChange={(e) => updateEducation(idx, "startYear", e.target.value)}
                            placeholder="e.g. 2021"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">End Year / Expected</label>
                          <input
                            type="text"
                            value={edu.endYear}
                            onChange={(e) => updateEducation(idx, "endYear", e.target.value)}
                            placeholder="e.g. 2025"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Experience */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-900">Experience / Internships</h2>
                  </div>
                  <button
                    type="button"
                    onClick={addExperience}
                    className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Experience
                  </button>
                </div>

                <div className="space-y-6">
                  {experience.map((exp, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-gray-50 border border-gray-200 relative group">
                      {experience.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExperience(idx)}
                          className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1"
                          title="Remove Experience"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Company / Organization</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) => updateExperience(idx, "company", e.target.value)}
                            placeholder="e.g. TechCorp Solutions"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Role / Position</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => updateExperience(idx, "role", e.target.value)}
                            placeholder="e.g. Frontend Intern"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                          <input
                            type="text"
                            value={exp.startDate}
                            onChange={(e) => updateExperience(idx, "startDate", e.target.value)}
                            placeholder="e.g. June 2023"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                          <input
                            type="text"
                            value={exp.endDate}
                            onChange={(e) => updateExperience(idx, "endDate", e.target.value)}
                            placeholder="e.g. Present or Aug 2023"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Description / Key Responsibilities</label>
                          <textarea
                            rows={3}
                            value={exp.description}
                            onChange={(e) => updateExperience(idx, "description", e.target.value)}
                            placeholder="Describe your achievements and work performed..."
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Projects */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Code className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-900">Projects</h2>
                  </div>
                  <button
                    type="button"
                    onClick={addProject}
                    className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Project
                  </button>
                </div>

                <div className="space-y-6">
                  {projects.map((proj, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-gray-50 border border-gray-200 relative group">
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProject(idx)}
                          className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1"
                          title="Remove Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Project Title</label>
                          <input
                            type="text"
                            value={proj.title}
                            onChange={(e) => updateProject(idx, "title", e.target.value)}
                            placeholder="e.g. E-Commerce Platform"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Technologies Used (Comma Separated)</label>
                          <input
                            type="text"
                            value={proj.techInput || ""}
                            onChange={(e) => updateProject(idx, "techInput", e.target.value)}
                            placeholder="e.g. React, Node.js, MongoDB"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">GitHub Repo Link</label>
                          <input
                            type="url"
                            value={proj.github}
                            onChange={(e) => updateProject(idx, "github", e.target.value)}
                            placeholder="https://github.com/username/project"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Live Demo Link</label>
                          <input
                            type="url"
                            value={proj.liveLink}
                            onChange={(e) => updateProject(idx, "liveLink", e.target.value)}
                            placeholder="https://myproject.vercel.app"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Project Description</label>
                          <textarea
                            rows={3}
                            value={proj.description}
                            onChange={(e) => updateProject(idx, "description", e.target.value)}
                            placeholder="Describe key features, implementation details, and impact..."
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: Skills */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
                  <Award className="h-6 w-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-900">Skills</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Type skills (e.g. JavaScript, React, Python) and press Add or Enter"
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
                    >
                      Add Skill
                    </button>
                  </div>

                  {skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200 font-medium"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="ml-2 text-blue-500 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No skills added yet.</p>
                  )}
                </div>
              </div>

              {/* Section 6: Certifications */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Award className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-900">Certifications</h2>
                  </div>
                  <button
                    type="button"
                    onClick={addCertification}
                    className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Certification
                  </button>
                </div>

                <div className="space-y-4">
                  {certifications.map((cert, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-gray-50 border border-gray-200 relative group">
                      {certifications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCertification(idx)}
                          className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1"
                          title="Remove Certification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Certification Name</label>
                          <input
                            type="text"
                            value={cert.title}
                            onChange={(e) => updateCertification(idx, "title", e.target.value)}
                            placeholder="e.g. AWS Certified Developer"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Issuing Organization</label>
                          <input
                            type="text"
                            value={cert.organization}
                            onChange={(e) => updateCertification(idx, "organization", e.target.value)}
                            placeholder="e.g. Amazon Web Services"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
                          <input
                            type="text"
                            value={cert.year}
                            onChange={(e) => updateCertification(idx, "year", e.target.value)}
                            placeholder="e.g. 2023"
                            className="w-full px-3 py-2 rounded border border-gray-300 text-sm bg-white text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 7: Achievements */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-900">Key Achievements</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={achievementInput}
                      onChange={(e) => setAchievementInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAchievement();
                        }
                      }}
                      placeholder="e.g. 1st Place in College Hackathon 2023"
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={addAchievement}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
                    >
                      Add Achievement
                    </button>
                  </div>

                  {achievements.length > 0 ? (
                    <ul className="space-y-2 pt-2">
                      {achievements.map((ach, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800"
                        >
                          <span>• {ach}</span>
                          <button
                            type="button"
                            onClick={() => removeAchievement(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No achievements added yet.</p>
                  )}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex flex-wrap items-center justify-end gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl shadow transition-all duration-200 disabled:opacity-50 text-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Saving Resume Draft...
                    </>
                  ) : (
                    <>
                      <Save className="-ml-1 mr-2 h-4 w-4" />
                      Save Draft
                    </>
                  )}
                </button>

                {paymentCompleted ? (
                  <button
                    type="button"
                    onClick={() => handleGeneratePdf()}
                    disabled={generatingPdf}
                    className="inline-flex items-center px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 text-base"
                  >
                    {generatingPdf ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="-ml-1 mr-2 h-5 w-5" />
                        {resumeUrl ? "Re-Generate PDF Resume" : "Generate & Download PDF"}
                      </>
                    )}
                  </button>
                ) : isVerified ? (
                  <button
                    type="button"
                    onClick={handleInitiatePayment}
                    disabled={processingPayment}
                    className="inline-flex items-center px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 text-base"
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                        Opening Razorpay...
                      </>
                    ) : (
                      <>
                        <CreditCard className="-ml-1 mr-2 h-5 w-5" />
                        Pay ₹50 with Razorpay
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateClick}
                    className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 text-base"
                  >
                    <Sparkles className="-ml-1 mr-2 h-5 w-5" />
                    Generate PDF - ₹50
                  </button>
                )}
              </div>
            </form>
          )}

          {/* LIVE PREVIEW COLUMN */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className={viewMode === "split" ? "sticky top-6" : "w-full"}>
              <ResumePreview
                data={previewData}
                selectedTemplate={selectedTemplate}
                onTemplateChange={(tpl) => setSelectedTemplate(tpl)}
              />
            </div>
          )}
        </div>
      </div>

      {/* OTP Verification Modal */}
      <OtpVerificationModal
        isOpen={showOtpModal}
        email={personalInfo.email}
        onClose={() => setShowOtpModal(false)}
        onSuccess={handleOtpSuccess}
      />
    </div>
  );
};

export default ResumeBuilder;
