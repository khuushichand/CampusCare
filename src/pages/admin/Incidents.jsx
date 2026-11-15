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
} from 'lucide-react';
import { getIncidents, getReports, updateIncidentStatus } from '../../services/api';
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

    // Update the visible row immediately, then roll back if the API rejects it.
    setIncidents((current) =>
      current.map((item) =>
        item.incident_id === incidentId ? { ...item, status: nextStatus } : item
      )
    );

    try {
      await updateIncidentStatus(incidentId, nextStatus);
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((report, index) => {
                    const reportId = getReportId(report);
                    const imageUrl = reportImageUrl(report);
                    return (
                      <tr key={reportId !== 'N/A' ? reportId : index} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-mono font-semibold text-slate-900 whitespace-nowrap">{reportId}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{report.student_id || report.student_name || 'Student'}</td>
                        <td className="px-5 py-4 min-w-48">
                          <p className="font-semibold text-slate-800">{report.title || report.category || 'Maintenance issue'}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{report.description || 'No description provided.'}</p>
                          {report.category && <span className="inline-block mt-1 text-xs text-slate-400">{report.category}</span>}
                        </td>
                        <td className="px-5 py-4 min-w-32">{report.location || 'Campus'}</td>
                        <td className="px-5 py-4">
                          {imageUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedImage({ url: imageUrl, reportId })}
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
                          <StatusBadge status={report.status || report.lifecycle_status || 'REPORT QUEUED'} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-500">{formatDate(report.created_at || report.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredIncidents.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <AlertTriangle className="w-9 h-9 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No incidents found</p>
              <p className="text-sm text-slate-500 mt-1">Try changing your search or status filter.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-slate-100">
                {['All', 'Open', 'In Progress', 'Resolved'].map((filter) => (
                  <button
                    type="button"
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={clsx(
                      'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                      statusFilter === filter
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
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
                        <td className="px-5 py-4 font-mono font-medium text-slate-900 whitespace-nowrap">{incident.incident_id}</td>
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
                        <td className="px-5 py-4"><SeverityBadge severity={incident.severity} /></td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <StatusBadge status={incident.status} />
                            <select
                              value={(incident.status || 'OPEN').toUpperCase()}
                              onChange={(event) => handleIncidentStatusChange(incident.incident_id, event.target.value)}
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
            </>
          )
        )}
      </div>

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
