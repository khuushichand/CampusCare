import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { adminIncidents } from '../../data/mockData';
import clsx from 'clsx';

const SeverityBadge = ({ severity }) => {
  const styles = {
    'Critical': 'bg-red-100 text-red-700 border-red-200',
    'High': 'bg-orange-100 text-orange-700 border-orange-200',
    'Medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Low': 'bg-green-100 text-green-700 border-green-200'
  };

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[severity])}>
      {severity}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    'Open': 'bg-purple-100 text-purple-700 border-purple-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'Resolved': 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[status])}>
      {status}
    </span>
  );
};

const Incidents = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const filteredIncidents = adminIncidents.filter(inc => {
    const matchesSearch = inc.issue.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inc.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incidents</h1>
          <p className="text-slate-500 mt-1">Review and manage reported campus issues</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search incidents..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {['All', 'Open', 'In Progress', 'Resolved'].map(filter => (
          <button 
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              statusFilter === filter 
                ? "bg-slate-800 text-white" 
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Incident ID</th>
                <th className="px-6 py-4 font-semibold">Issue</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold">Reported By</th>
                <th className="px-6 py-4 font-semibold">Severity</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Reported</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIncidents.map(inc => (
                <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-900">{inc.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 truncate max-w-[200px]">{inc.issue}</td>
                  <td className="px-6 py-4">{inc.location}</td>
                  <td className="px-6 py-4">{inc.reportedBy}</td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={inc.severity} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={inc.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{inc.date.split(',')[0]}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => navigate(`/admin/incidents/${inc.id}`)}
                      className="text-blue-600 font-medium hover:text-blue-800 flex items-center justify-end gap-1 w-full"
                    >
                      View Details <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    No incidents found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Incidents;
