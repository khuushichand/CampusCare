import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, FileText,
  Calendar, MapPin, Tag, AlertTriangle, Loader2, ShieldCheck, Image as ImageIcon
} from 'lucide-react';
import { getReportById, API_BASE_URL } from '../../services/api';
import clsx from 'clsx';

const StatusBadge = ({ status, lifecycleStatus }) => {
  if (status === 'RESOLVED' || status === 'Resolved') {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Resolved
      </span>
    );
  }

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

  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      Queued
    </span>
  );
};

const ReportDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadReport = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const data = await getReportById(id);
        if (isMounted) {
          if (data && data.report) {
            setReport(data.report);
          } else {
            setErrorMessage('Report not found');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch report:', err);
          setErrorMessage(err.message || 'Unable to load report details.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadReport();
    return () => { isMounted = false; };
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto text-center mt-20 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm">Fetching report details from backend...</p>
      </div>
    );
  }

  if (errorMessage || !report) {
    return (
      <div className="max-w-3xl mx-auto text-center mt-12 bg-white p-8 rounded-2xl border border-slate-200">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Unable to View Report</h2>
        <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
          {errorMessage || 'The requested report could not be found or you may not have access.'}
        </p>
        <button
          onClick={() => navigate('/student/my-reports')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Back to My Reports
        </button>
      </div>
    );
  }

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: 'numeric', hour12: true
      });
    } catch {
      return isoString;
    }
  };

  const isProcessing = report.lifecycle_status === 'PROCESSING' || report.lifecycle_status === 'PROCESSED';
  const isProcessed = report.lifecycle_status === 'PROCESSED';
  const isResolved = (report.incident?.status || '').toUpperCase() === 'RESOLVED';

  const timelineEvents = [
    {
      status: 'Report submitted to campus stream',
      date: formatDate(report.created_at),
      active: true,
      completed: true,
    },
    {
      status: isProcessed
        ? `Processed & linked to Incident (${report.incident_id || 'INC'})`
        : isProcessing
          ? 'Being processed by background consumer'
          : 'Queued in Redis Stream',
      date: report.incident?.created_at ? formatDate(report.incident.created_at) : (isProcessing ? 'In progress' : 'Awaiting worker'),
      active: isProcessing || isProcessed,
      completed: isProcessed,
    },
    {
      status: isResolved ? 'Issue resolved by maintenance' : 'Under maintenance review',
      date: report.incident?.updated_at ? formatDate(report.incident.updated_at) : (isProcessed ? 'Active' : 'Pending review'),
      active: isProcessed,
      completed: isResolved,
    },
  ];

  const imageUrl = report.image_url
    ? `${API_BASE_URL.replace(/\/$/, '')}${report.image_url.startsWith('/') ? report.image_url : `/${report.image_url}`}`
    : '';

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
                  {report.title || report.category}
                  <StatusBadge
                    status={report.incident?.status || report.status}
                    lifecycleStatus={report.lifecycle_status}
                  />
                </h1>
                <p className="text-slate-500 flex items-center gap-1.5 mt-2 text-sm">
                  <MapPin className="w-4 h-4" /> {report.location} • {report.category}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">Report ID</p>
                <p className="font-semibold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg font-mono text-sm">
                  {report.report_id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-6 text-sm py-6 border-y border-slate-100">
              <div>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                  <Calendar className="w-4 h-4" /> Submitted On
                </p>
                <p className="font-semibold text-slate-900 ml-5.5">{formatDate(report.created_at)}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                  <Tag className="w-4 h-4" /> Equipment
                </p>
                <p className="font-semibold text-slate-900 ml-5.5">
                  {report.equipment_id ? report.equipment_id : 'General / Facility'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                  <Clock className="w-4 h-4" /> Consumer Status
                </p>
                <p className="font-semibold text-slate-900 ml-5.5 capitalize">
                  {report.lifecycle_status?.toLowerCase() || 'queued'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4" /> Linked Incident
                </p>
                <p className="font-semibold text-slate-900 ml-5.5">
                  {report.incident_id ? (
                    <span className="font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {report.incident_id}
                    </span>
                  ) : (
                    <span className="text-slate-400">Pending grouping</span>
                  )}
                </p>
              </div>
            </div>

            <div className="pt-6">
              <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4" /> Description
              </p>
              <p className="text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl text-sm">
                {report.description}
              </p>
            </div>

            {imageUrl && (
              <div className="pt-6">
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mb-3">
                  <ImageIcon className="w-4 h-4" /> Attached Photo
                </p>
                <a href={imageUrl} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={imageUrl}
                    alt="Photo attached to this issue report"
                    className="w-full max-h-96 object-contain rounded-xl border border-slate-200 bg-slate-50"
                    loading="lazy"
                  />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Timeline */}
        <div className="w-full md:w-80">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-6">Processing Updates</h3>

            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {timelineEvents.map((event, idx) => (
                <div key={idx} className="relative flex items-start gap-4 z-10">
                  <div className={clsx(
                    'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5',
                    event.completed
                      ? 'border-green-600 bg-green-50 text-green-600 flex items-center justify-center'
                      : event.active
                        ? 'border-blue-600 bg-white'
                        : 'border-slate-200 bg-slate-200'
                  )}>
                    {event.completed ? (
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    ) : event.active ? (
                      <div className="w-2.5 h-2.5 bg-blue-600 rounded-full m-[3px]"></div>
                    ) : null}
                  </div>
                  <div>
                    <p className={clsx(
                      'font-medium text-sm',
                      event.active ? 'text-slate-900' : 'text-slate-500'
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
