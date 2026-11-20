import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, MapPin, Tag, AlertTriangle, AlertCircle, 
  FileText, Settings, Loader2, CheckCircle2, Image as ImageIcon, X
} from 'lucide-react';
import {
  getIncident,
  updateIncidentStatus,
  getEquipmentById,
  getReports
} from '../../services/api';
import clsx from 'clsx';

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  'http://127.0.0.1:8000';

const getReportIdentifier = (report) =>
  String(report.report_id || report.id || report.ticket_id || '');

const getImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
};

const SeverityBadge = ({ severity }) => {
  const normSev = (severity || 'MEDIUM').toUpperCase();
  const styles = {
    'CRITICAL': 'bg-red-100 text-red-700 border-red-200',
    'HIGH': 'bg-orange-100 text-orange-700 border-orange-200',
    'MEDIUM': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'LOW': 'bg-green-100 text-green-700 border-green-200'
  };

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[normSev] || styles['MEDIUM'])}>
      {normSev}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const normStat = (status || 'OPEN').toUpperCase();
  const styles = {
    'OPEN': 'bg-purple-100 text-purple-700 border-purple-200',
    'IN_PROGRESS': 'bg-blue-100 text-blue-700 border-blue-200',
    'RESOLVED': 'bg-green-100 text-green-700 border-green-200',
    'CLOSED': 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const label = normStat === 'IN_PROGRESS' ? 'In Progress' : normStat.charAt(0) + normStat.slice(1).toLowerCase();

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[normStat] || styles['OPEN'])}>
      {label}
    </span>
  );
};

const IncidentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [equipmentDetails, setEquipmentDetails] = useState(null);
  const [associatedReports, setAssociatedReports] = useState([]);
  const [reportsLoadError, setReportsLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Status update state
  const [selectedStatus, setSelectedStatus] = useState('OPEN');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchIncidentDetails = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setIncident(null);
    setEquipmentDetails(null);
    setAssociatedReports([]);
    setReportsLoadError('');
    setSelectedImage(null);
    try {
      const data = await getIncident(id);
      if (data && data.incident) {
        setIncident(data.incident);
        setSelectedStatus((data.incident.status || 'OPEN').toUpperCase());

        // Fetch the original student submissions linked to this incident.
        // Incident records store report IDs; GET /api/reports returns the full report
        // hashes, including image_url when a student attached a photograph.
        setReportsLoadError('');
        try {
          const reportsResponse = await getReports();
          const allReports = Array.isArray(reportsResponse)
            ? reportsResponse
            : Array.isArray(reportsResponse?.reports)
              ? reportsResponse.reports
              : Array.isArray(reportsResponse?.data?.reports)
                ? reportsResponse.data.reports
                : [];

          const incidentReportReferences = [
            ...(Array.isArray(data.incident.reports) ? data.incident.reports : []),
            ...(Array.isArray(data.incident.report_ids) ? data.incident.report_ids : []),
            data.incident.report_id,
            data.incident.latest_report_id,
          ];

          // Some API responses return report IDs, while others may expose
          // the incident_id directly on each report. Support both shapes.
          const linkedReportIds = new Set(
            incidentReportReferences
              .map((item) => (
                typeof item === 'string'
                  ? item
                  : item?.report_id || item?.id || item?.ticket_id
              ))
              .filter(Boolean)
              .map(String)
          );

          const linked = allReports.filter((report) =>
            linkedReportIds.has(getReportIdentifier(report)) ||
            String(report.incident_id || '') === String(data.incident.incident_id || '')
          );

          setAssociatedReports(linked);
          if (linked.length === 0 && linkedReportIds.size > 0) {
            setReportsLoadError(
              'The incident contains report references, but the reports API did not return matching student records.'
            );
          } else if (linked.length === 0) {
            setReportsLoadError(
              'No linked student report records were returned for this incident. The incident may only contain a stream reference.'
            );
          }
        } catch (reportsError) {
          console.error('Failed to load student reports linked to incident:', reportsError);
          setAssociatedReports([]);
          setReportsLoadError(reportsError.message || 'Unable to load the original student submissions.');
        }

        // Fetch equipment metrics if equipment_id is linked
        if (data.incident.equipment_id) {
          try {
            const eq = await getEquipmentById(data.incident.equipment_id);
            setEquipmentDetails(eq);
          } catch {
            setEquipmentDetails(null);
          }
        }
      } else {
        setErrorMessage('Incident not found');
      }
    } catch (err) {
      console.error("Failed to load incident:", err);
      setErrorMessage(err.message || 'Unable to connect to backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentDetails();
  }, [id]);

  const handleStatusUpdate = async () => {
    if (!incident) return;
    setIsUpdatingStatus(true);
    setStatusFeedback(null);
    try {
      const res = await updateIncidentStatus(incident.incident_id, selectedStatus);
      if (res && res.incident) {
        setIncident(res.incident);
        setSelectedStatus((res.incident.status || selectedStatus).toUpperCase());
      } else {
        setIncident(prev => ({ ...prev, status: selectedStatus }));
      }
      // Keep associated student reports synchronized
      setAssociatedReports(prev =>
        prev.map(r => ({ ...r, status: selectedStatus, incident_status: selectedStatus }))
      );
      setStatusFeedback({ type: 'success', message: `Status updated to ${selectedStatus} successfully. Linked student reports synchronized.` });
    } catch (err) {
      console.error("Failed to update status:", err);
      setStatusFeedback({ type: 'error', message: err.message || 'Failed to update status.' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto text-center mt-20 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading incident details from backend...</p>
      </div>
    );
  }

  if (errorMessage || !incident) {
    return (
      <div className="max-w-4xl mx-auto text-center mt-12 bg-white p-8 rounded-2xl border border-slate-200">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Incident Not Found</h2>
        <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
          {errorMessage || "The requested incident record does not exist in the database."}
        </p>
        <button 
          onClick={() => navigate('/admin/incidents')} 
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Back to Incidents
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

  // The current API exposes created_at and updated_at, not a full audit log.
  // Show only verifiable record timestamps rather than inventing status history.
  const timelineEvents = [
    {
      status: 'Incident created',
      date: formatDate(incident.created_at),
      active: true,
    },
  ];

  if (incident.updated_at && incident.updated_at !== incident.created_at) {
    timelineEvents.push({
      status: 'Incident record last updated',
      date: formatDate(incident.updated_at),
      active: true,
    });
  }

  timelineEvents.push({
    status: `Current status: ${(incident.status || 'OPEN').replace('_', ' ')}`,
    date: 'Current',
    active: true,
  });

  const eqHealth = equipmentDetails ? parseInt(equipmentDetails.health_score || 0, 10) : null;
  const eqRisk = equipmentDetails ? parseFloat(equipmentDetails.risk_score || 0) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/incidents')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 shadow-sm font-medium text-sm"
            title="Back to incidents list"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Incidents</span>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{incident.title}</h1>
              <StatusBadge status={incident.status} />
            </div>
            <p className="text-slate-500 mt-1 font-mono font-medium text-sm">{incident.incident_id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left / Main Section */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Incident Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Incident Information
            </h3>
            
            <div className="grid grid-cols-2 gap-y-6 text-sm">
              <div>
                <p className="text-slate-500 font-medium mb-1">Incident ID</p>
                <p className="font-mono font-semibold text-slate-900">{incident.incident_id}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1">Issue Category</p>
                <p className="font-semibold text-slate-900">{incident.category || 'General'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 font-medium mb-1">Description</p>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {incident.description || 'No detailed description provided.'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4"/> Location</p>
                <p className="font-semibold text-slate-900">{incident.location || 'Campus'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Settings className="w-4 h-4"/> Equipment ID</p>
                <p className="font-mono font-semibold text-slate-900">
                  {incident.equipment_id ? incident.equipment_id : 'None / Facility'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Tag className="w-4 h-4"/> Total Associated Reports</p>
                <p className="font-semibold text-slate-900">{incident.report_count || '1'} student report(s)</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Clock className="w-4 h-4"/> Created At</p>
                <p className="font-semibold text-slate-900">{formatDate(incident.created_at)}</p>
              </div>
              <div className="col-span-2 pt-2">
                <p className="text-slate-500 font-medium mb-2">Severity Level</p>
                <SeverityBadge severity={incident.severity} />
              </div>
            </div>
          </div>

          {/* Equipment Risk Context */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" /> Equipment Risk Context
            </h3>

            {incident.equipment_id ? (
              <div className="flex flex-col md:flex-row gap-8 mb-6 pb-6 border-b border-slate-100">
                <div className="flex-1">
                  <p className="text-sm text-slate-500 font-medium mb-1">Equipment</p>
                  <p className="font-semibold text-slate-900 mb-4">
                    {equipmentDetails ? `${equipmentDetails.name} (${equipmentDetails.id})` : incident.equipment_id}
                  </p>
                  
                  <p className="text-sm text-slate-500 font-medium mb-1">Operational Status</p>
                  <span className={clsx(
                    "px-2.5 py-1 rounded-full text-xs font-semibold inline-block",
                    (equipmentDetails?.status || '').toLowerCase() === 'critical' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                  )}>
                    {equipmentDetails?.status || 'Active'}
                  </span>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-500">Health Score</span>
                      <span className="font-bold text-slate-900">{eqHealth !== null ? `${eqHealth}%` : 'N/A'}</span>
                    </div>
                    {eqHealth !== null && (
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={clsx("h-full rounded-full", eqHealth < 40 ? "bg-red-500" : eqHealth < 70 ? "bg-orange-500" : "bg-green-500")}
                          style={{ width: `${Math.min(100, Math.max(0, eqHealth))}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-500">Deterministic Risk Score</span>
                      <span className="font-bold text-slate-900">{eqRisk !== null ? eqRisk : 'N/A'}</span>
                    </div>
                    {eqRisk !== null && (
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={clsx("h-full rounded-full", eqRisk >= 80 ? "bg-red-500" : "bg-orange-500")}
                          style={{ width: `${Math.min(100, Math.max(0, eqRisk))}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100">
                This incident is a general facility/location issue not linked to a tracked asset.
              </p>
            )}

            {/* Linked Reports and original student submissions */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-4">Associated Stream Reports</h4>

              {incident.reports && incident.reports.length > 0 ? (
                <div className="space-y-2 mb-5">
                  {incident.reports.map((repId) => (
                    <div
                      key={repId}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm"
                    >
                      <span className="font-mono font-semibold text-slate-900">{repId}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                        Grouped Report
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 mb-5">
                  Initial report: <span className="font-mono font-semibold text-slate-800">{incident.report_id || 'N/A'}</span>
                </p>
              )}

              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  Original Student Submissions
                </h4>

                {reportsLoadError && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
                    {reportsLoadError}
                  </p>
                )}

                {associatedReports.length > 0 ? (
                  <div className="space-y-4">
                    {associatedReports.map((report) => {
                      const reportId = getReportIdentifier(report) || 'Report';
                      const imageUrl = getImageUrl(report.image_url);

                      return (
                        <div
                          key={reportId}
                          className="rounded-xl border border-slate-200 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-sm font-semibold text-slate-900">
                              {reportId}
                            </span>
                            <span className="text-xs text-slate-500">
                              Student: {report.student_id || report.student_name || 'N/A'}
                            </span>
                          </div>

                          <div>
                            <p className="font-semibold text-sm text-slate-800">
                              {report.title || report.category || 'Maintenance report'}
                            </p>
                            {report.category && (
                              <p className="text-xs text-slate-500 mt-1">
                                Category: {report.category}
                              </p>
                            )}
                          </div>

                          <p className="text-sm text-slate-600 whitespace-pre-wrap">
                            {report.description || 'No description provided.'}
                          </p>

                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                            {report.location && <span>Location: {report.location}</span>}
                            {report.created_at && <span>Submitted: {formatDate(report.created_at)}</span>}
                          </div>

                          {imageUrl ? (
                            <div className="pt-2">
                              <p className="text-xs font-semibold text-slate-500 mb-2">
                                ATTACHED PHOTOGRAPH
                              </p>
                              <button
                                type="button"
                                onClick={() => setSelectedImage({ url: imageUrl, reportId })}
                                className="inline-block text-left"
                                title="Preview attached photograph"
                              >
                                <img
                                  src={imageUrl}
                                  alt={`Student attachment for ${reportId}`}
                                  className="max-w-full w-auto max-h-72 object-contain rounded-xl border border-slate-200 bg-slate-50 hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                />
                                <span className="block text-xs text-blue-600 mt-1">Click to enlarge</span>
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" />
                              No photograph attached to this report.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Full report details will appear here when the reports API returns records matching this incident's report IDs.
                  </p>
                )}
              </div>
            </div>
            </div>
          </div>

        {/* Right / Side Section */}
        <div className="space-y-6">
          
          {/* Status & Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Status & Actions</h3>
            
            {statusFeedback && (
              <div className={clsx(
                "p-3 rounded-xl text-xs font-medium mb-4 flex items-center gap-2",
                statusFeedback.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
              )}>
                {statusFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{statusFeedback.message}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Update Incident Status</label>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  disabled={isUpdatingStatus}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              
              <button 
                onClick={handleStatusUpdate}
                disabled={isUpdatingStatus || selectedStatus === (incident.status || '').toUpperCase()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors shadow-sm text-sm flex items-center justify-center gap-2"
              >
                {isUpdatingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  'Update Status'
                )}
              </button>
            </div>
          </div>

          {/* Activity / Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Incident Activity</h3>
            
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {timelineEvents.map((event, idx) => (
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
                      "font-medium text-sm leading-snug",
                      event.active ? "text-slate-900" : "text-slate-600"
                    )}>
                      {event.status}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
          role="presentation"
        >
          <div
            className="relative max-w-5xl max-h-[90vh] bg-white rounded-2xl p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Photo attached to ${selectedImage.reportId}`}
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-700 shadow-lg flex items-center justify-center"
              aria-label="Close photo preview"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="text-sm font-semibold text-slate-700 px-2 py-2">
              {selectedImage.reportId} · Attached photo
            </p>
            <img
              src={selectedImage.url}
              alt={`Student attachment for ${selectedImage.reportId}`}
              className="max-h-[75vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentDetails;
