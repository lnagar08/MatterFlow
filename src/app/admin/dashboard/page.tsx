// app/(admin)/admin/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";
import { Users, Scale, Activity } from "lucide-react"; // Optional: npm install lucide-react

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalClients: 0, totalAttorneys: 0, activeNow: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Stats fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = [
    { label: "Total Attorneys", value: stats.totalAttorneys, icon: <Scale />, color: "text-purple-600" },
    { label: "Total Clients", value: stats.totalClients, icon: <Users />, color: "text-blue-600" },
    { label: "Active Sessions", value: stats.activeNow, icon: <Activity />, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">System Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className={`p-3 rounded-lg bg-gray-50 ${card.color}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase">{card.label}</p>
              <h3 className="text-2xl font-bold">
                {loading ? "..." : card.value}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}