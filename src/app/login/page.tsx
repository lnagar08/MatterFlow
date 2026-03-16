"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, LogIn } from "lucide-react"; // Icons for consistent design

/**
 * Modern Login Page
 * Matches the MatterFlow registration design with Next-Auth integration.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Added loading state
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true); // Start loading

    const result = await signIn("credentials", {
      email: email.toLowerCase(),
      password: password,
      redirect: false, 
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsLoading(false); // Stop loading on error
    } else {
      router.push("/home"); 
      router.refresh();
    }
  };

  return (
    // Main Wrapper: Centered layout with a soft grey background
    <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] p-4">
      
      {/* Login Card: Professional shadow and rounded corners */}
      <div className="w-full max-w-md bg-white p-10 shadow-xl rounded-2xl border border-gray-100">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-4">
            <LogIn className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Login</h2>
          <p className="text-sm text-gray-500 mt-2 font-medium">Welcome back to MatterFlow</p>
        </div>
        
        {/* Error Feedback */}
        {error && (
          <div className="mb-6 p-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl text-center font-medium animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Email Input Group */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                placeholder="example@mail.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Password Input Group */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Optional: Forgot Password Link */}
          <div className="flex justify-end">
            <a href="#" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
              Forgot password?
            </a>
          </div>

          {/* Submit Button with Dynamic States */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer: Redirect to Registration */}
        <p className="mt-8 text-center text-sm font-medium text-gray-500">
          New to the platform?{" "}
          <a href="/register" className="text-blue-600 hover:text-blue-700 font-bold transition-colors">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
