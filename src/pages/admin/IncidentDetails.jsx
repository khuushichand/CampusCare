import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Tag, AlertTriangle, AlertCircle, FileText, Settings, User } from 'lucide-react';
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

const IncidentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const incident = adminIncidents.find(inc => inc.id === id);
  
  const [status, setStatus] = useState(incident?.status || 'Open');

  if (!incident) {
    return (
      <div className="max-w-4xl mx-auto text-center mt-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Incident not found</h2>
        <button onClick={() => navigate('/admin/incidents')} className="text-blue-600 font-medium">Back to Incidents</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/incidents')}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{incident.issue}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-slate-500 mt-1 font-medium">{incident.id}</p>
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
                <p className="font-semibold text-slate-900">{incident.id}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1">Issue Type</p>
                <p className="font-semibold text-slate-900">{incident.issueType}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 font-medium mb-1">Description</p>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {incident.description}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4"/> Location</p>
                <p className="font-semibold text-slate-900">{incident.location}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Settings className="w-4 h-4"/> Equipment</p>
                <p className="font-semibold text-slate-900">{incident.equipment}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><User className="w-4 h-4"/> Reported By</p>
                <p className="font-semibold text-slate-900">{incident.reportedBy}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Clock className="w-4 h-4"/> Reported Date</p>
                <p className="font-semibold text-slate-900">{incident.date}</p>
              </div>
              <div className="col-span-2 pt-2">
                <p className="text-slate-500 font-medium mb-2">Severity</p>
                <SeverityBadge severity={incident.severity} />
              </div>
            </div>
          </div>

          {/* Equipment Risk Context */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" /> Equipment Risk
            </h3>

            <div className="flex flex-col md:flex-row gap-8 mb-8 pb-8 border-b border-slate-100">
              <div className="flex-1">
                <p className="text-sm text-slate-500 font-medium mb-1">Equipment</p>
                <p className="font-semibold text-slate-900 mb-4">{incident.equipment}</p>
                
                <p className="text-sm text-slate-500 font-medium mb-1">Status</p>
                <span className={clsx(
                  "px-2.5 py-1 rounded-full text-xs font-semibold inline-block",
                  incident.equipmentStatus === 'Critical' || incident.equipmentStatus === 'High Risk' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                )}>
                  {incident.equipmentStatus}
                </span>
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-500">Health Score</span>
                    <span className="font-bold text-slate-900">{incident.healthScore}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={clsx("h-full rounded-full", incident.healthScore < 40 ? "bg-red-500" : incident.healthScore < 70 ? "bg-orange-500" : "bg-green-500")}
                      style={{ width: `${incident.healthScore}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-500">Risk Score</span>
                    <span className="font-bold text-slate-900">{incident.riskScore}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={clsx("h-full rounded-full", incident.riskScore > 80 ? "bg-red-500" : "bg-orange-500")}
                      style={{ width: `${incident.riskScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-4">Related Reports</h4>
              {incident.relatedIncidents && incident.relatedIncidents.length > 0 ? (
                <div className="space-y-3">
                  {incident.relatedIncidents.map(rel => (
                    <div 
                      key={rel.id}
                      onClick={() => navigate(`/admin/incidents/${rel.id}`)}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900">{rel.id}</span>
                        <span className="text-sm text-slate-600">{rel.issue}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-medium">{rel.date}</span>
                        <StatusBadge status={rel.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No related reports found for this equipment.</p>
              )}
            </div>
          </div>

        </div>

        {/* Right / Side Section */}
        <div className="space-y-6">
          
          {/* Status & Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Status & Actions</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Update Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
              
              <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                Update Status
              </button>
            </div>
          </div>

          {/* Activity / Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Incident Activity</h3>
            
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {incident.timeline?.map((event, idx) => (
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
      
    </div>
  );
};

export default IncidentDetails;
