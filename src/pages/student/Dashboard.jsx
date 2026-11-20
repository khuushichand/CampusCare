import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Megaphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { getMyReports } from '../../services/api';
import clsx from 'clsx';

const StatusBadge = ({ status, lifecycleStatus }) => {
  const normalizedStatus = (status || '').toUpperCase();

  let label = 'Queued';
  let style = 'bg-blue-100 text-blue-700';

  if (normalizedStatus === 'RESOLVED' || normalizedStatus === 'CLOSED') {
    label = 'Resolved';
    style = 'bg-green-100 text-green-700';
  } else if (normalizedStatus === 'IN_PROGRESS') {
    label = 'In Progress';
    style = 'bg-blue-100 text-blue-700';
  } else if (lifecycleStatus === 'PROCESSED' || normalizedStatus === 'OPEN') {
    label = 'Incident Assigned';
    style = 'bg-purple-100 text-purple-700';
  } else if (lifecycleStatus === 'PROCESSING') {
    label = 'Processing';
    style = 'bg-orange-100 text-orange-700';
  }

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', style)}>
      {label}
    </span>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('campuscare_user') || '{}');
    } catch {
      return {};
    }
  })();

  const fetchReports = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await getMyReports();
      setReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch (error) {
      console.error('Dashboard report fetch failed:', error);
      setErrorMessage(error.message || 'Unable to load your reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const recentReports = [...reports]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 3);

  const formatDate = (date) => {
    if (!date) return 'Recently submitted';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return date;

    return parsedDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getReportIcon = (report) => {
    const status = (report.incident?.status || report.status || '').toUpperCase();

    if (status === 'RESOLVED' || status === 'CLOSED') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }

    if (status === 'IN_PROGRESS') {
      return <Clock className="w-5 h-5 text-blue-500" />;
    }

    if (report.lifecycle_status === 'PROCESSED' || status === 'OPEN') {
      return <CheckCircle2 className="w-5 h-5 text-purple-500" />;
    }

    if (report.lifecycle_status === 'PROCESSING') {
      return <Clock className="w-5 h-5 text-orange-500" />;
    }

    return <AlertCircle className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Good afternoon, {storedUser.name || 'Student'}! 👋
        </h1>
        <p className="text-slate-500 mt-2">
          Have something that needs attention?
        </p>
      </div>

      {/* Report CTA */}
      <div
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
        onClick={() => navigate('/student/report-issue')}
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <Megaphone className="w-8 h-8 text-blue-600" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Report an Issue
            </h2>
            <p className="text-sm text-slate-500">
              Let us know if something on campus isn't working properly.
            </p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-slate-400">
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>

      {/* Recent Reports */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            My Reports
          </h2>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchReports}
              disabled={isLoading}
              className="text-slate-500 hover:text-blue-600"
              title="Refresh reports"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>

            <button
              onClick={() => navigate('/student/my-reports')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

          {isLoading ? (
            <div className="p-8 flex justify-center items-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              Loading your reports...
            </div>
          ) : errorMessage ? (
            <div className="p-8 text-center text-red-600 text-sm">
              {errorMessage}
              <button
                onClick={fetchReports}
                className="block mx-auto mt-3 text-blue-600 underline"
              >
                Try again
              </button>
            </div>
          ) : recentReports.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No reports submitted yet. Click "Report an Issue" above to submit one.
            </div>
          ) : (
            recentReports.map((report) => (
              <div
                key={report.report_id}
                onClick={() => navigate(`/student/reports/${report.report_id}`)}
                className="p-5 flex items-start justify-between hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex gap-4">
                  <div className="mt-1">
                    {getReportIcon(report)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">
                        {report.title || report.equipment_id || report.category}
                      </span>

                      <span className="text-slate-300">•</span>

                      <span className="text-sm text-slate-500">
                        {report.location}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 line-clamp-1">
                      {report.description}
                    </p>
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
    </div>
  );
};

export default Dashboard;