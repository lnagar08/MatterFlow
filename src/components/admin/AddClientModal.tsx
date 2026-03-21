// components/admin/AddClientModal.tsx
"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function AddClientModal({ isOpen, onClose, onClientAdded, firms }: any) {
  const [attorneys, setAttorneys] = useState([]);

  useEffect(() => {
  // Fetch only users with role ATTORNEY
  fetch("/api/admin/users") 
    .then(res => res.json())
    .then(data => setAttorneys(data));
}, []);

  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    logoUrl: "",
    firmId: "",
    userId: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onClientAdded(data);
      onClose();
      toast.success("Client created!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add New Client</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input 
            placeholder="Client Name" 
            className="w-full p-2 border rounded"
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required 
          />
          <input 
            placeholder="Company Name" 
            className="w-full p-2 border rounded"
            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
            required 
          />
          <div className="space-y-1">
          <label className="text-sm font-medium">Assign Attorney</label>
          <select 
            className="w-full p-2 border rounded-md"
            value={formData.userId}
            onChange={(e) => setFormData({...formData, userId: e.target.value})}
          >
            <option value="">Select an Attorney</option>
            {attorneys.map((atty: any) => (
              <option key={atty.id} value={atty.id}>{atty.name}</option>
            ))}
          </select>
        </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}