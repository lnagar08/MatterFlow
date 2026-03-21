// app/(admin)/admin/clients/page.tsx
"use client";
import { useState, useEffect } from "react";
import AddClientModal from "@/components/admin/AddClientModal";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  //const [firms, setFirms] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Fetch both clients and firms (to fill the dropdown)
    Promise.all([
      fetch("/api/admin/clients").then(res => res.json()),
      //fetch("/api/firms").then(res => res.json()) // Assumes you have a firm API
    ]).then(([clientData]) => {
      setClients(clientData);
      //setFirms(firmData);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Client Management</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          + Add Client
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Client Name</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Company</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Attorney</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((client: any) => (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-800">{client.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{client.companyName}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{client.firm?.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(client.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddClientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        //firms={firms}
        onClientAdded={(newClient: any) => setClients([newClient, ...clients] as any)}
      />
    </div>
  );
}