import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Megaphone, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { getReports, user } from '../../data/mockData';
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

const Dashboard = () => {
  const navigate = useNavigate();
  const reports = getReports().slice(0, 3); // Get top 3 recent

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Greeting Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Good afternoon, {user.name}! 👋</h1>
        <p className="text-slate-500 mt-2">Have something that needs attention?</p>
      </div>

      {/* Report CTA Card */}
      <div 
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
        onClick={() => navigate('/student/report-issue')}
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <Megaphone className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Report an Issue</h2>
            <p className="text-sm text-slate-500">Let us know if something on campus isn't working properly.</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-slate-400">
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>

      {/* Recent Reports List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">My Reports</h2>
          <button className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {reports.map((report) => (
            <div key={report.id} className="p-5 flex items-start justify-between hover:bg-slate-50 transition-colors">
              <div className="flex gap-4">
                <div className="mt-1">
                  {report.status === 'Resolved' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : report.status === 'In Progress' ? (
                    <Clock className="w-5 h-5 text-blue-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">{report.equipment}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-sm text-slate-500">{report.location}</span>
                  </div>
                  <p className="text-sm text-slate-500">{report.description}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={report.status} />
                <span className="text-xs text-slate-400 font-medium">{report.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
