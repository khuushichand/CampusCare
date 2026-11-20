import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  X,
  ClipboardList,
  AlertTriangle,
  ArrowLeft,
  User,
  MapPin,
  Tag,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { getIncidents, getReports, updateIncidentStatus, updateReportStatus } from '../../services/api';
import clsx from 'clsx';

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  'http://127.0.0.1:8000';

const SeverityBadge = ({ severity }) => {
  const normSev = (severity || 'MEDIUM').toUpperCase();
  const styles = {
    CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    LOW: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[normSev] || styles.MEDIUM)}>
      {normSev}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const normStat = (status || 'OPEN').toUpperCase();
  const styles = {
    OPEN: 'bg-purple-100 text-purple-700 border-purple-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
    RESOLVED: 'bg-green-100 text-green-700 border-green-200',
    CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    'REPORT QUEUED': 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const label = normStat === 'IN_PROGRESS'
    ? 'In Progress'
    : normStat === 'REPORT QUEUED'
      ? 'Report Queued'
      : normStat.charAt(0) + normStat.slice(1).toLowerCase();

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[normStat] || 'bg-slate-100 text-slate-700 border-slate-200')}>
      {label}
    </span>
  );
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

const getReportId = (report) => report.report_id || report.id || report.ticket_id || 'N/A';

const Incidents = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [incidents, setIncidents] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [updatingIncidentId, setUpdatingIncidentId] = useState(null);

  const fetchManagementData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const [incidentResult, reportResult] = await Promise.allSettled([
      getIncidents(),
      getReports(),
    ]);

    const errors = [];

    if (incidentResult.status === 'fulfilled') {
      const data = incidentResult.value;
      setIncidents(Array.isArray(data?.incidents) ? data.incidents : []);
    } else {
      console.error('Failed to load incidents:', incidentResult.reason);
      errors.push(`Incidents: ${incidentResult.reason?.message || 'Could not load'}`);
    }

    if (reportResult.status === 'fulfilled') {
      const data = reportResult.value;
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.reports)
          ? data.reports
          : Array.isArray(data?.data?.reports)
            ? data.data.reports
            : [];
      setReports(list);
    } else {
      console.error('Failed to load student reports:', reportResult.reason);
      errors.push(`Student reports: ${reportResult.reason?.message || 'Could not load'}`);
    }

    if (errors.length) {
      setErrorMessage(errors.join(' | '));
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchManagementData();
  }, [fetchManagementData]);

  const incidentStatusCounts = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;
    incidents.forEach((inc) => {
      const s = (inc.status || 'OPEN').toUpperCase();
      if (s === 'OPEN') open += 1;
      else if (s === 'IN_PROGRESS') inProgress += 1;
      else if (s === 'RESOLVED' || s === 'CLOSED') resolved += 1;
    });
    return {
      All: incidents.length,
      Open: open,
      'In Progress': inProgress,
      Resolved: resolved,
    };
  }, [incidents]);

  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const searchable = [
      incident.incident_id,
      incident.title,
      incident.description,
      incident.location,
      incident.category,
    ].join(' ').toLowerCase();

    const matchesSearch = searchable.includes(searchTerm.toLowerCase());
    const status = (incident.status || 'OPEN').toUpperCase();
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Open' && status === 'OPEN') ||
      (statusFilter === 'In Progress' && status === 'IN_PROGRESS') ||
      (statusFilter === 'Resolved' && (status === 'RESOLVED' || status === 'CLOSED'));

    return matchesSearch && matchesStatus;
  }), [incidents, searchTerm, statusFilter]);

  const filteredReports = useMemo(() => reports.filter((report) => {
    const searchable = [
      getReportId(report),
      report.student_id,
      report.title,
      report.description,
      report.category,
      report.location,
      report.equipment_id,
      report.incident_id,
    ].join(' ').toLowerCase();

    return searchable.includes(searchTerm.toLowerCase());
  }), [reports, searchTerm]);

  const getLinkedReportIds = (incident) => {
    const idsFromIncident = Array.isArray(incident.report_ids)
      ? incident.report_ids
      : [];
    const idsFromReports = reports
      .filter((report) => report.incident_id === incident.incident_id)
      .map(getReportId);
    return [...new Set([...idsFromIncident, ...idsFromReports].filter(Boolean))];
  };

  const handleIncidentStatusChange = async (incidentId, nextStatus) => {
    const currentIncident = incidents.find((item) => item.incident_id === incidentId);
    if (!currentIncident || currentIncident.status === nextStatus) return;

    const previousStatus = currentIncident.status || 'OPEN';
    setUpdatingIncidentId(incidentId);
    setErrorMessage('');

    // Update incidents immediately
    setIncidents((current) =>
      current.map((item) =>
        item.incident_id === incidentId ? { ...item, status: nextStatus } : item
      )
    );

    // Also optimistically update any linked reports in the reports table
    setReports((current) =>
      current.map((item) => {
        const isLinked =
          item.incident_id === incidentId ||
          currentIncident.report_ids?.includes(item.report_id) ||
          currentIncident.report_id === item.report_id ||
          currentIncident.latest_report_id === item.report_id;
        if (isLinked) {
          return { ...item, status: nextStatus, incident_status: nextStatus };
        }
        return item;
      })
    );

    try {
      await updateIncidentStatus(incidentId, nextStatus);
      // Re-fetch management data so reports and incidents stay 100% in sync
      await fetchManagementData();
    } catch (error) {
      setIncidents((current) =>
        current.map((item) =>
          item.incident_id === incidentId
            ? { ...item, status: previousStatus }
            : item
        )
      );
      setErrorMessage(`Could not update ${incidentId}: ${error.message}`);
    } finally {
      setUpdatingIncidentId(null);
    }
  };

  const handleReportStatusChange = async (report, nextStatus) => {
    const reportId = getReportId(report);
    if (!reportId || (report.status || 'OPEN').toUpperCase() === nextStatus) return;

    setUpdatingIncidentId(reportId);
    setErrorMessage('');

    // Optimistically update selected report state
    setSelectedReport((prev) => (prev ? { ...prev, status: nextStatus } : null));

    try {
      if (report.incident_id) {
        await updateIncidentStatus(report.incident_id, nextStatus);
      } else {
        await updateReportStatus(reportId, nextStatus);
      }
      await fetchManagementData();
    } catch (error) {
      setErrorMessage(`Could not update report status: ${error.message}`);
    } finally {
      setUpdatingIncidentId(null);
    }
  };

  const reportImageUrl = (report) => {
    if (!report.image_url) return '';
    if (/^https?:\/\//i.test(report.image_url)) return report.image_url;
    return `${API_BASE_URL}${report.image_url.startsWith('/') ? '' : '/'}${report.image_url}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Incidents</h1>
          <p className="text-slate-500 mt-1">
            Review student-submitted complaints and incidents processed by CampusCare.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchManagementData}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
          title="Refresh reports and incidents"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin text-blue-600')} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={clsx(
            'inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'reports'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <FileText className="w-4 h-4" />
          Student Reports
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{reports.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('incidents')}
          className={clsx(
            'inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'incidents'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          Incidents
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{incidents.length}</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {activeTab === 'reports' ? 'Student-submitted reports' : 'Processed incidents'}
          </h2>
          <p className="text-sm text-slate-500">
            {activeTab === 'reports'
              ? 'Reports submitted from the student portal, including attached photographs.'
              : 'Related student reports grouped into maintenance incidents by the background worker.'}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'reports' ? 'Search student reports...' : 'Search incidents...'}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-4 text-amber-800 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}. Data from the endpoint that succeeded is still shown.</span>
          </div>
          <button type="button" onClick={fetchManagementData} className="text-xs font-bold underline shrink-0">
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto mb-3" />
            Loading reports and incidents from CampusCare...
          </div>
        ) : activeTab === 'reports' ? (
          filteredReports.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <ClipboardList className="w-9 h-9 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No student reports found</p>
              <p className="text-sm text-slate-500 mt-1">
                {reports.length === 0
                  ? 'Reports submitted by students will appear here once returned by the backend.'
                  : 'Try changing your search.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Report</th>
                    <th className="px-5 py-4 font-semibold">Student</th>
                    <th className="px-5 py-4 font-semibold">Issue</th>
                    <th className="px-5 py-4 font-semibold">Location</th>
                    <th className="px-5 py-4 font-semibold">Photo</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Submitted</th>
                    <th className="px-5 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((report, index) => {
                    const reportId = getReportId(report);
                    const imageUrl = reportImageUrl(report);
                    return (
                      <tr
                        key={reportId !== 'N/A' ? reportId : index}
                        onClick={() => setSelectedReport(report)}
                        className="hover:bg-slate-50/70 cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {reportId}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {report.student_id || report.student_name || 'Student'}
                        </td>
                        <td className="px-5 py-4 min-w-48">
                          <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {report.title || report.category || 'Maintenance issue'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {report.description || 'No description provided.'}
                          </p>
                          {report.category && (
                            <span className="inline-block mt-1 text-xs text-slate-400">
                              {report.category}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 min-w-32">{report.location || 'Campus'}</td>
                        <td className="px-5 py-4">
                          {imageUrl ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage({ url: imageUrl, reportId });
                              }}
                              className="group relative block"
                              title={`View photo for ${reportId}`}
                            >
                              <img
                                src={imageUrl}
                                alt={`Attachment for ${reportId}`}
                                className="w-16 h-14 object-cover rounded-lg border border-slate-200 group-hover:opacity-80"
                                loading="lazy"
                              />
                              <span className="sr-only">View attached photo</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <ImageIcon className="w-4 h-4" /> No photo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReport(report);
                            }}
                            className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-full"
                            title="Click to view full complaint details"
                          >
                            <StatusBadge status={report.status || report.lifecycle_status || 'REPORT QUEUED'} />
                          </button>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                          {formatDate(report.created_at || report.timestamp)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReport(report);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                            title="View registered complaint details"
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div>
            {/* Filter Tabs - Always Visible on Incidents tab */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: 'All', count: incidentStatusCounts.All },
                  { label: 'Open', count: incidentStatusCounts.Open },
                  { label: 'In Progress', count: incidentStatusCounts['In Progress'] },
                  { label: 'Resolved', count: incidentStatusCounts.Resolved },
                ].map(({ label, count }) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => setStatusFilter(label)}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5',
                      statusFilter === label
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    <span>{label}</span>
                    <span
                      className={clsx(
                        'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                        statusFilter === label
                          ? 'bg-slate-700 text-slate-100'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {statusFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('All')}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to All Incidents</span>
                </button>
              )}
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <AlertTriangle className="w-9 h-9 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">
                  No {statusFilter !== 'All' ? `"${statusFilter}" ` : ''}incidents found
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {statusFilter !== 'All'
                    ? `There are no incidents currently in "${statusFilter}" status.`
                    : 'Try changing your search.'}
                </p>
                {statusFilter !== 'All' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('All');
                      setSearchTerm('');
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to All Incidents</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Incident ID</th>
                      <th className="px-5 py-4 font-semibold">Issue</th>
                      <th className="px-5 py-4 font-semibold">Location</th>
                      <th className="px-5 py-4 font-semibold">Equipment</th>
                      <th className="px-5 py-4 font-semibold">Linked Reports</th>
                      <th className="px-5 py-4 font-semibold">Severity</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Reported</th>
                      <th className="px-5 py-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIncidents.map((incident) => (
                      <tr key={incident.incident_id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {incident.incident_id}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-900 min-w-40">{incident.title}</td>
                        <td className="px-5 py-4">{incident.location || 'Campus'}</td>
                        <td className="px-5 py-4 font-mono text-xs">{incident.equipment_id || 'N/A'}</td>
                        <td className="px-5 py-4">
                          {(() => {
                            const linkedIds = getLinkedReportIds(incident);
                            const linkedCount = Number(incident.report_count) || linkedIds.length || 1;
                            return linkedIds.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('reports');
                                  setSearchTerm(linkedIds[0] || incident.incident_id);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                                title={`Search reports linked to ${incident.incident_id}`}
                              >
                                {linkedCount} · View
                              </button>
                            ) : (
                              <span>{linkedCount}</span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-4">
                          <SeverityBadge severity={incident.severity} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <StatusBadge status={incident.status} />
                            <select
                              value={(incident.status || 'OPEN').toUpperCase()}
                              onChange={(event) =>
                                handleIncidentStatusChange(incident.incident_id, event.target.value)
                              }
                              disabled={updatingIncidentId === incident.incident_id}
                              aria-label={`Update status for ${incident.incident_id}`}
                              className="max-w-36 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              <option value="OPEN">Open</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="RESOLVED">Resolved</option>
                            </select>
                            {updatingIncidentId === incident.incident_id && (
                              <span className="text-xs text-slate-400">Saving...</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{formatDate(incident.created_at)}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/incidents/${incident.incident_id}`)}
                            className="text-blue-600 font-medium hover:text-blue-800 inline-flex items-center gap-1"
                          >
                            View Details <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedReport && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedReport(null)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Registered Complaint Details"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {getReportId(selectedReport)}
                    </span>
                    <StatusBadge status={selectedReport.status || selectedReport.lifecycle_status || 'REPORT QUEUED'} />
                  </div>
                  <p className="text-xs text-slate-500">Student Complaint Details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Title & Description */}
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedReport.title || 'Untitled Complaint'}
                </h3>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedReport.description || 'No description provided by student.'}
                </div>
              </div>

              {/* Grid of metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Submitted By</p>
                    <p className="font-semibold text-slate-800">
                      {selectedReport.student_id || selectedReport.student_name || 'Anonymous Student'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Location</p>
                    <p className="font-semibold text-slate-800">
                      {selectedReport.location || 'Campus / General'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</p>
                    <p className="font-semibold text-slate-800">
                      {selectedReport.category || 'General Maintenance'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Submitted On</p>
                    <p className="font-semibold text-slate-800">
                      {formatDate(selectedReport.created_at || selectedReport.timestamp)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Linked Equipment or Incident */}
              {(selectedReport.equipment_id || selectedReport.incident_id) && (
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-3 text-sm">
                  {selectedReport.equipment_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-700 font-medium">Equipment:</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/equipment/${selectedReport.equipment_id}`)}
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-800 bg-white px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100/50"
                      >
                        {selectedReport.equipment_id}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {selectedReport.incident_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-700 font-medium">Processed Incident:</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/incidents/${selectedReport.incident_id}`)}
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-800 bg-white px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100/50"
                      >
                        {selectedReport.incident_id}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Attached Image if available */}
              {reportImageUrl(selectedReport) ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Attached Photograph
                  </p>
                  <div
                    className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 max-h-64 flex items-center justify-center cursor-pointer group"
                    onClick={() =>
                      setSelectedImage({
                        url: reportImageUrl(selectedReport),
                        reportId: getReportId(selectedReport),
                      })
                    }
                  >
                    <img
                      src={reportImageUrl(selectedReport)}
                      alt={`Photo for ${getReportId(selectedReport)}`}
                      className="max-h-64 w-full object-contain group-hover:opacity-90 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-black/75 text-white text-xs font-semibold rounded-lg shadow-sm transition-opacity">
                        Click to enlarge
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Update Status:</span>
                <select
                  value={(selectedReport.status || 'OPEN').toUpperCase()}
                  onChange={(e) => handleReportStatusChange(selectedReport, e.target.value)}
                  disabled={updatingIncidentId === getReportId(selectedReport)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
                {updatingIncidentId === getReportId(selectedReport) && (
                  <span className="text-xs text-slate-400">Updating...</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
          role="presentation"
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Photo attached to ${selectedImage.reportId}`}
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-700 shadow-lg flex items-center justify-center"
              aria-label="Close image"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="text-sm font-semibold text-slate-700 px-2 py-2">{selectedImage.reportId} · Attached photo</p>
            <img src={selectedImage.url} alt={`Attachment for ${selectedImage.reportId}`} className="max-h-[75vh] max-w-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Incidents;
