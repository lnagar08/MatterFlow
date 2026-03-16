"use client";

import React, { useState } from 'react';
import { User, Mail, Lock, Briefcase, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
/**
 * RegisterForm Component
 * Features: Form validation, Loading states, Role selection, and Responsive layout.
 */
export default function RegisterForm() {
    const router = useRouter();
  // --- 1. STATE MANAGEMENT ---
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ATTORNEY' // Default role as requested
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- 2. EVENT HANDLERS ---
  
  // Updates state dynamically based on input name attribute
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error message when user starts correcting the form
    if (errorMessage) setErrorMessage('');
  };

  // Handles form submission logic
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Basic Validation: Ensure all fields are filled
    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      setErrorMessage("All fields are strictly required.");
      setIsLoading(false);
      return;
    }

    // 1. Data Cleaning: Remove extra spaces from start and end
    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPassword = formData.password.trim();

    // 2. Validation Rules
    
    // Name Validation: Minimum 2 characters
    if (cleanName.length < 2) {
        setErrorMessage("Name must be at least 2 characters long.");
        setIsLoading(false);
        return;
    }

    // 1. Email Format Validation (Regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        setErrorMessage("Please enter a valid email address.");
        setIsLoading(false);
        return;
    }

    // 2. Password Validation: Minimum 6 characters
    if (cleanPassword.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        setIsLoading(false);
        return;
    }

    // 3. API Call with Cleaned Data
    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...formData,
                name: cleanName,
                email: cleanEmail,
                password: cleanPassword
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            
            setErrorMessage(data.error || "An unexpected error occurred");
            return;
        }

        // Show a beautiful green success toast
        toast.success("Account created successfully! Welcome to MatterFlow.");

        // Delay the redirection by 2 seconds so the user can see the success toast
        setTimeout(() => {
            router.push("/login");
        }, 2000);

    } catch (error) {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Main Wrapper: Centered layout with a light grey background
    <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] p-6">
      
      {/* Form Container: Card style with shadow and border */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-10">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Join MatterFlow</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">Create an account to start managing cases</p>
        </div>

        {/* Error Feedback: Displays when validation fails */}
        {errorMessage && (
          <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100 flex items-center gap-2">
             <span className="font-bold">Error:</span> {errorMessage}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleFormSubmit} className="space-y-6">
          
          {/* Full Name Input Group */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Full Name</label>
            <div className="relative group">
              <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                placeholder="Enter your name"
              />
            </div>
          </div>

          {/* Email Address Input Group */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                placeholder="example@mail.com"
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
                name="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Role Selection Dropdown Group }
          <div className="relative flex items-center w-full group">
            
            <div className="absolute left-4 z-10 pointer-events-none">
                <Briefcase className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500" />
            </div>

            
            <select
                name="role"
                required
                value={formData.role}
                onChange={handleInputChange}
                
                style={{ paddingLeft: '50px', appearance: 'none' }}
                className="w-full pr-10 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none cursor-pointer text-gray-700"
            >
                <option value="CLIENT">CLIENT</option>
                <option value="ATTORNEY">ATTORNEY</option>
            </select>

            
            <div className="absolute right-4 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            </div>
            {*/}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              "Complete Registration"
            )}
          </button>
        </form>

        {/* Footer Link */}
        <p className="mt-8 text-center text-sm font-medium text-gray-500">
          Already a member? <a href="/login" className="text-blue-600 hover:text-blue-700 font-bold transition-colors">Sign in here</a>
        </p>
      </div>
    </div>
  );
}
