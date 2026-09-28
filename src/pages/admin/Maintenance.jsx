import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, CheckCircle2, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { adminMaintenance } from '../../data/mockData';
import clsx from 'clsx';

const StatusBadge = ({ status }) => {
  const styles = {
    'Completed': 'bg-green-100 text-green-700 border-green-200',
    'Scheduled': 'bg-blue-100 text-blue-700 border-blue-200',
    'In Progress': 'bg-purple-100 text-purple-700 border-purple-200',
    'Overdue': 'bg-red-100 text-red-700 border-red-200'
  };

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[status] || 'bg-slate-100 text-slate-700 border-slate-200')}>
      {status}
    </span>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
    <div className="flex items-center gap-3 mb-3">
      <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center", color.bg)}>
        <Icon className={clsx("w-5 h-5", color.text)} />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
    </div>
    <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
  </div>
);

const Maintenance = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [maintenanceRecords, setMaintenanceRecords] = useState(adminMaintenance);

  const filteredRecords = maintenanceRecords.filter(record => filter === 'All' || record.status === filter);

  const handleStatusChange = (id, newStatus) => {
    setMaintenanceRecords(maintenanceRecords.map(m => m.id === id ? { ...m, status: newStatus } : m));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-slate-500 mt-1">Track scheduled and completed equipment maintenance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Scheduled" value="5" icon={Calendar} color={{ bg: 'bg-blue-50', text: 'text-blue-600' }} />
        <StatCard title="In Progress" value="2" icon={Activity} color={{ bg: 'bg-purple-50', text: 'text-purple-600' }} />
        <StatCard title="Completed" value="18" icon={CheckCircle2} color={{ bg: 'bg-green-50', text: 'text-green-600' }} />
        <StatCard title="Overdue" value="3" icon={AlertTriangle} color={{ bg: 'bg-red-50', text: 'text-red-600' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Table */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center gap-2">
            {['All', 'Scheduled', 'In Progress', 'Completed', 'Overdue'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  filter === f 
                    ? "bg-slate-800 text-white" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">ID</th>
                    <th className="px-6 py-4 font-semibold">Equipment & Location</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Scheduled Date</th>
                    <th className="px-6 py-4 font-semibold">Technician</th>
                    <th className="px-6 py-4 font-semibold">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{m.id}</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => navigate(`/admin/equipment/${m.equipmentId}`)}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline block mb-1"
                        >
                          {m.equipmentId} {m.equipmentName}
                        </button>
                        <span className="text-slate-500 text-xs">{m.location}</span>
                        {m.incidentId && (
                          <button 
                            onClick={() => navigate(`/admin/incidents/${m.incidentId}`)}
                            className="text-xs text-slate-400 hover:text-slate-600 hover:underline ml-3"
                          >
                            Incident: {m.incidentId}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{m.maintenanceType}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar className="w-4 h-4" /> {m.scheduledDate}
                        </div>
                      </td>
                      <td className="px-6 py-4">{m.technician}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 items-start">
                          <StatusBadge status={m.status} />
                          <select 
                            value={m.status}
                            onChange={(e) => handleStatusChange(m.id, e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-xs rounded p-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Scheduled">Set Scheduled</option>
                            <option value="In Progress">Set In Progress</option>
                            <option value="Completed">Set Completed</option>
                            <option value="Overdue">Set Overdue</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                        No maintenance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Predictive Maintenance Info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="font-bold text-slate-900">Predictive Maintenance</h3>
          </div>
          
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Maintenance priorities will later be generated from equipment health, risk scores, historical failures and recent issue activity.
          </p>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
            <ArrowRight className="w-4 h-4" /> Backend integration planned
          </div>
        </div>

      </div>
    </div>
  );
};

export default Maintenance;
