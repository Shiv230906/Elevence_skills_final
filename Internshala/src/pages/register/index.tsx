import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { auth } from "@/firebase/firebase";
import { createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { User, Mail, Phone, AtSign, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const { fullName, email, phone, username, password, confirmPassword } = formData;

    // 1. Required fields validation
    if (!fullName.trim() || !email.trim() || !phone.trim() || !username.trim() || !password || !confirmPassword) {
      const msg = "Please fill in all required fields.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      const msg = "Please enter a valid email address.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    // 3. Phone number validation (at least 10 digits)
    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      const msg = "Please enter a valid 10-digit phone number.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    // 4. Username format validation (alphanumeric and underscores)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username.trim())) {
      const msg = "Username must be 3-30 characters (letters, numbers, underscores).";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    // 5. Password length
    if (password.length < 6) {
      const msg = "Password must be at least 6 characters.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    // 6. Password confirmation
    if (password !== confirmPassword) {
      const msg = "Passwords do not match.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    try {
      setIsLoading(true);

      // 7. Check if user already exists in database
      const checkRes = await fetch(`${BACKEND_URL}/api/auth/check-exists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          username: username.trim(),
          phone: cleanedPhone,
        }),
      });

      const checkData = await checkRes.json();
      if (checkData.exists) {
        setErrorMessage(checkData.message || "An account with these details already exists.");
        toast.error(checkData.message || "Account already exists.");
        return;
      }

      // 8. Create Firebase Authentication Account
      let firebaseUser: any = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        firebaseUser = userCredential.user;

        // Update Firebase profile with Full Name
        await updateProfile(firebaseUser, {
          displayName: fullName.trim(),
        });
      } catch (fbError: any) {
        console.error("Firebase registration error:", fbError);
        if (fbError.code === "auth/email-already-in-use") {
          const msg = "An account with this email address already exists. Please login.";
          setErrorMessage(msg);
          toast.error(msg);
          return;
        }
        if (fbError.code === "auth/weak-password") {
          const msg = "Password is too weak. Please use a stronger password.";
          setErrorMessage(msg);
          toast.error(msg);
          return;
        }
        const msg = fbError.message || "Failed to create authentication account.";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      // 9. Store profile/details in the database
      const dbRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: cleanedPhone,
          password: password,
        }),
      });

      const dbData = await dbRes.json();
      if (!dbRes.ok || !dbData.success) {
        console.warn("Database sync warning:", dbData.message);
      }

      // Sign out from Firebase so user goes through the normal login + OTP verification flow
      try {
        await signOut(auth);
      } catch (_) {}

      toast.success("Account created successfully! Please sign in to verify.");
      router.push("/login");
    } catch (err: any) {
      console.error("Registration error:", err);
      const msg = "An unexpected error occurred during registration. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Register — InternArea / Elevance</title>
        <meta
          name="description"
          content="Create a new account on InternArea to apply for top internships and jobs."
        />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block mb-4">
          <img src="/logo.png" alt="InternArea Logo" className="h-14 mx-auto" />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Create an Account
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Join InternArea to discover internships, career opportunities, and free certifications
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Full Name
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. Shivani Sharma"
                  className="block w-full text-black pl-11 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="block w-full text-black pl-11 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Phone Number
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Phone className="h-5 w-5" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  className="block w-full text-black pl-11 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <AtSign className="h-5 w-5" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="e.g. shivani_26"
                  className="block w-full text-black pl-11 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
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

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className="block w-full text-black pl-11 pr-11 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating your account...</span>
                  </div>
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </form>

          {/* Already have an account? Login */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-500 hover:underline transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
