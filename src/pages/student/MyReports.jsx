import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { getMyReports } from '../../services/api';
import clsx from 'clsx';

const StatusBadge = ({ status, lifecycleStatus }) => {
  // If report has a linked incident with resolved status
  if (status === 'RESOLVED' || status === 'Resolved') {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Resolved
      </span>
    );
  }

  // Lifecycle status badge
  if (lifecycleStatus === 'PROCESSED') {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
        Incident Linked
      </span>
    );
  }

  if (lifecycleStatus === 'PROCESSING') {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        Processing
      </span>
    );
  }

  // Default queued
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      Queued
    </span>
  );
};

const MyReports = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchReports = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await getMyReports();
      if (data && Array.isArray(data.reports)) {
        setReports(data.reports);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error("Failed to load student reports:", err);
      setErrorMessage(err.message || "Failed to load reports from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = reports.filter(report => {
    const isResolved = (report.incident?.status || report.status || '').toUpperCase() === 'RESOLVED';
    if (filter === 'All') return true;
    if (filter === 'Active') return !isResolved;
    if (filter === 'Resolved') return isResolved;
    return true;
  });

  const getStatusIcon = (report) => {
    const isResolved = (report.incident?.status || report.status || '').toUpperCase() === 'RESOLVED';
    if (isResolved) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (report.lifecycle_status === 'PROCESSED') return <Clock className="w-5 h-5 text-purple-500" />;
    if (report.lifecycle_status === 'PROCESSING') return <AlertCircle className="w-5 h-5 text-orange-500" />;
    return <Clock className="w-5 h-5 text-blue-500" />;
  };

  const activeCount = reports.filter(r => (r.incident?.status || r.status || '').toUpperCase() !== 'RESOLVED').length;
  const resolvedCount = reports.filter(r => (r.incident?.status || r.status || '').toUpperCase() === 'RESOLVED').length;

  const counts = {
    All: reports.length,
    Active: activeCount,
    Resolved: resolvedCount,
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Authoritative reports tracked by CampusCare</p>
        </div>
        <button
          onClick={fetchReports}
          disabled={isLoading}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium"
          title="Refresh reports"
        >
          <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
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
            {tab} ({counts[tab] || 0})
          </button>
        ))}
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
          <button 
            onClick={fetchReports}
            className="text-xs underline font-semibold text-red-800 hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Reports List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm">Loading your submitted reports from backend...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">No reports found</p>
            <p className="text-sm text-slate-400 mb-4">
              {filter === 'All' 
                ? "You haven't submitted any maintenance reports yet." 
                : `No ${filter.toLowerCase()} reports at this time.`}
            </p>
            {filter === 'All' && (
              <button
                onClick={() => navigate('/student/report-issue')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Report an Issue
              </button>
            )}
          </div>
        ) : (
          filteredReports.map((report) => (
            <div 
              key={report.report_id} 
              onClick={() => navigate(`/student/reports/${report.report_id}`)}
              className="p-5 flex items-start justify-between hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex gap-4">
                <div className="mt-1">
                  {getStatusIcon(report)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">
                      {report.title || report.equipment_id || report.category}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-sm text-slate-500">{report.location}</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-2 line-clamp-1">{report.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {report.report_id}
                    </span>
                    {report.incident_id && (
                      <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                        Incident: {report.incident_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <StatusBadge 
                  status={report.incident?.status || report.status} 
                  lifecycleStatus={report.lifecycle_status} 
                />
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                  {formatDate(report.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyReports;
