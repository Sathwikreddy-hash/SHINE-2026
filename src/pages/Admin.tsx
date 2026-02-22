import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Ban, Trash2, AlertTriangle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    const [usersRes, reportsRes] = await Promise.all([
      fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/reports', { headers: { Authorization: `Bearer ${token}` } })
    ]);
    setUsers(await usersRes.json());
    // setReports(await reportsRes.json()); // Need to implement GET /api/reports for admin
    setLoading(false);
  };

  const handleBan = async (id: number) => {
    await fetch(`/api/admin/ban/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchAdminData();
  };

  if (user?.role !== 'admin') {
    return <div className="p-8 text-center">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5" /> All Students
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-gray-50">
                    <th className="pb-4 font-medium">Name</th>
                    <th className="pb-4 font-medium">Class</th>
                    <th className="pb-4 font-medium">Status</th>
                    <th className="pb-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.id} className="text-sm">
                      <td className="py-4">
                        <p className="font-semibold">{u.name}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </td>
                      <td className="py-4">{u.class}-{u.section}</td>
                      <td className="py-4">
                        {u.is_banned ? (
                          <span className="px-2 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-bold uppercase">Banned</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-50 text-green-500 rounded-full text-[10px] font-bold uppercase">Active</span>
                        )}
                      </td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          {!u.is_banned && (
                            <button 
                              onClick={() => handleBan(u.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              title="Ban User"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                          <button className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete Account">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Recent Reports
            </h2>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm italic">No active reports found.</p>
              {/* Report items would go here */}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
