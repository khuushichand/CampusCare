import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, FileText, Calendar, MapPin, Tag, AlertTriangle } from 'lucide-react';
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

const ReportDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const reports = getReports();
  
  const report = reports.find(r => r.id === id);

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto text-center mt-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Report not found</h2>
        <button onClick={() => navigate('/student/my-reports')} className="text-blue-600 font-medium">Back to My Reports</button>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    if (status === 'Resolved') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === 'In Progress') return <Clock className="w-5 h-5 text-blue-500" />;
    return <AlertCircle className="w-5 h-5 text-orange-500" />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button 
        onClick={() => navigate('/student/my-reports')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to My Reports
      </button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left column: Details */}
        <div className="flex-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                  {report.equipment}
                  <StatusBadge status={report.status} />
                </h1>
                <p className="text-slate-500 flex items-center gap-1.5 mt-2 text-sm">
                  <MapPin className="w-4 h-4" /> {report.location} • {report.category}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">Incident ID</p>
                <p className="font-semibold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">{report.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-6 text-sm py-6 border-y border-slate-100">
              <div>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                  <Calendar className="w-4 h-4" /> Reported on
                </p>
                <p className="font-semibold text-slate-900 ml-5.5">{report.date}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" /> Severity
                </p>
                <span className={clsx(
                  'font-semibold ml-5.5',
                  report.severity === 'Low' ? 'text-green-600' :
                  report.severity === 'Medium' ? 'text-orange-600' :
                  'text-red-600'
                )}>
                  {report.severity}
                </span>
              </div>
              <div>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                  <Tag className="w-4 h-4" /> Status
                </p>
                <p className="font-semibold text-slate-900 ml-5.5">{report.status}</p>
              </div>
            </div>

            <div className="pt-6">
              <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4" /> Description
              </p>
              <p className="text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl">
                {report.description}
              </p>
            </div>
          </div>
        </div>

        {/* Right column: Timeline */}
        <div className="w-full md:w-80">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-6">Updates</h3>
            
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {report.timeline?.map((event, idx) => (
                <div key={idx} className="relative flex items-start gap-4 z-10">
                  <div className={clsx(
                    "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5",
                    event.active 
                      ? "border-blue-600 bg-white" 
                      : "border-slate-200 bg-slate-200"
                  )}>
                    {event.active && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full m-[3px]"></div>}
                  </div>
                  <div>
                    <p className={clsx(
                      "font-medium text-sm",
                      event.active ? "text-slate-900" : "text-slate-500"
                    )}>
                      {event.status}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetails;
