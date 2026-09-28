import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { getReports } from '../../data/mockData';
import clsx from 'clsx';

const StatusBadge = ({ status }) => {
  const styles = {
    'Under Investigation': 'bg-orange-100 text-orange-700',
    'Resolved': 'bg-green-100 text-green-700',
    'In Progress': 'bg-blue-100 text-blue-700'
  };

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', styles[status])}>
      {status}
    </span>
  );
};

const MyReports = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const reports = getReports();

  const filteredReports = reports.filter(report => {
    if (filter === 'All') return true;
    if (filter === 'Active') return report.status !== 'Resolved';
    if (filter === 'Resolved') return report.status === 'Resolved';
    return true;
  });

  const getStatusIcon = (status) => {
    if (status === 'Resolved') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === 'In Progress') return <Clock className="w-5 h-5 text-blue-500" />;
    return <AlertCircle className="w-5 h-5 text-orange-500" />;
  };

  const counts = {
    All: reports.length,
    Active: reports.filter(r => r.status !== 'Resolved').length,
    Resolved: reports.filter(r => r.status === 'Resolved').length
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Reports</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['All', 'Active', 'Resolved'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === tab 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {filteredReports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No reports found.
          </div>
        ) : (
          filteredReports.map((report) => (
            <div 
              key={report.id} 
              onClick={() => navigate(`/student/reports/${report.id}`)}
              className="p-5 flex items-start justify-between hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex gap-4">
                <div className="mt-1">
                  {getStatusIcon(report.status)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">{report.equipment}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-sm text-slate-500">{report.location}</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-2">{report.description}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={report.status} />
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{report.date.split(',')[0]}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyReports;
