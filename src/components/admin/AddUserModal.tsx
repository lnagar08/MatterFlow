// components/admin/AddAttorneyModal.tsx
"use client";
import { useState } from "react";
import toast from "react-hot-toast";

export default function AddAttorneyModal({ isOpen, onClose, onUserAdded }: any) {
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    confirmPassword: "" 
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const validate = () => {
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }
    if (!formData.email.includes("@")) {
      toast.error("Invalid email address");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: "ATTORNEY" // Hardcoded since this is an Attorney modal
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create");

      onUserAdded(data);
      toast.success("Attorney added successfully!");
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Attorney</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            placeholder="Full Name"
            className="w-full p-2 border rounded-md"
            required
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email Address"
            className="w-full p-2 border rounded-md"
            required
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 border rounded-md"
            required
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full p-2 border rounded-md"
            required
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          />
          <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-md">Cancel</button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-indigo-300"
            >
              {loading ? "Creating..." : "Create Attorney"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}