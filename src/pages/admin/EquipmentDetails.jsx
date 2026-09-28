import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Calendar, Wrench, Settings, AlertTriangle } from 'lucide-react';
import { adminEquipment } from '../../data/mockData';
import clsx from 'clsx';

const StatusBadge = ({ status }) => {
  const styles = {
    'Healthy': 'bg-green-100 text-green-700 border-green-200',
    'Warning': 'bg-orange-100 text-orange-700 border-orange-200',
    'High Risk': 'bg-red-50 text-red-600 border-red-200',
    'Critical': 'bg-red-100 text-red-700 border-red-200'
  };

  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[status] || 'bg-slate-100 text-slate-700 border-slate-200')}>
      {status}
    </span>
  );
};

const SeverityBadge = ({ severity }) => {
  const styles = {
    'Critical': 'bg-red-100 text-red-700 border-red-200',
    'High': 'bg-red-100 text-red-700 border-red-200',
    'Medium': 'bg-orange-100 text-orange-700 border-orange-200',
    'Low': 'bg-green-100 text-green-700 border-green-200'
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold uppercase', styles[severity])}>
      {severity}
    </span>
  );
};

const IncidentStatusBadge = ({ status }) => {
  const styles = {
    'Open': 'text-purple-700 bg-purple-50',
    'In Progress': 'text-blue-700 bg-blue-50',
    'Resolved': 'text-slate-600 bg-slate-100'
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', styles[status])}>
      {status}
    </span>
  );
};

const EquipmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const eq = adminEquipment.find(e => e.id === id);

  if (!eq) {
    return (
      <div className="max-w-4xl mx-auto text-center mt-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Equipment not found</h2>
        <button onClick={() => navigate('/admin/equipment')} className="text-blue-600 font-medium">Back to Equipment</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/equipment')}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{eq.name}</h1>
              <StatusBadge status={eq.status} />
            </div>
            <p className="text-slate-500 mt-1 font-medium">{eq.id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left / Main Section */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Equipment Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" /> Equipment Information
            </h3>
            
            <div className="grid grid-cols-2 gap-y-6 text-sm">
              <div>
                <p className="text-slate-500 font-medium mb-1">Equipment ID</p>
                <p className="font-semibold text-slate-900">{eq.id}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1">Equipment Name</p>
                <p className="font-semibold text-slate-900">{eq.name}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1">Type</p>
                <p className="font-semibold text-slate-900">{eq.type}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1">Location</p>
                <p className="font-semibold text-slate-900">{eq.location}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Installation Date</p>
                <p className="font-semibold text-slate-900">{eq.installationDate}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Activity className="w-4 h-4"/> Age</p>
                <p className="font-semibold text-slate-900">{eq.age}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Wrench className="w-4 h-4"/> Last Maintenance</p>
                <p className="font-semibold text-slate-900">{eq.lastMaintenance}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> Total Failures</p>
                <p className="font-semibold text-slate-900">{eq.failureCount}</p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-4">
                <span className="text-sm font-medium text-slate-500">Current Status:</span>
                <StatusBadge status={eq.status} />
            </div>
          </div>

          {/* Maintenance History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-600" /> Maintenance History
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-y border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-medium rounded-l-lg">Date</th>
                    <th className="px-4 py-3 font-medium">Maintenance Type</th>
                    <th className="px-4 py-3 font-medium">Technician/Team</th>
                    <th className="px-4 py-3 font-medium rounded-r-lg">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eq.maintenanceHistory.map((maint, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{maint.date}</td>
                      <td className="px-4 py-3">{maint.type}</td>
                      <td className="px-4 py-3">{maint.team}</td>
                      <td className="px-4 py-3">
                        <span className="text-green-600 font-medium text-xs bg-green-50 px-2 py-0.5 rounded-full">{maint.result}</span>
                      </td>
                    </tr>
                  ))}
                  {eq.maintenanceHistory.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-4 py-6 text-center text-slate-500">No maintenance records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right / Side Section */}
        <div className="space-y-6">
          
          {/* Health & Risk Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" /> Equipment Health
            </h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-slate-700">Health Score</span>
                  <span className={clsx("font-bold", eq.healthScore >= 70 ? "text-green-600" : eq.healthScore >= 40 ? "text-orange-500" : "text-red-600")}>
                    {eq.healthScore}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={clsx("h-full rounded-full", eq.healthScore >= 70 ? "bg-green-500" : eq.healthScore >= 40 ? "bg-orange-500" : "bg-red-500")}
                    style={{ width: `${eq.healthScore}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-slate-700">Risk Score</span>
                  <span className={clsx("font-bold", eq.riskScore >= 70 ? "text-red-600" : eq.riskScore >= 40 ? "text-orange-500" : "text-green-600")}>
                    {eq.riskScore}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={clsx("h-full rounded-full", eq.riskScore >= 70 ? "bg-red-500" : eq.riskScore >= 40 ? "bg-orange-500" : "bg-green-500")}
                    style={{ width: `${eq.riskScore}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Historical Failures</p>
                <p className="text-xl font-bold text-slate-900">{eq.failureCount}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Recent Reports</p>
                <p className="text-xl font-bold text-slate-900">{eq.relatedIncidents.length}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Equipment Age</p>
                <p className="text-base font-bold text-slate-900 mt-1">{eq.age}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Downtime</p>
                <p className="text-base font-bold text-slate-900 mt-1">{eq.downtime}</p>
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-5">Risk Factors</h3>
            
            <div className="space-y-3">
              {eq.riskFactors.map((factor, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{factor.factor}</span>
                  <SeverityBadge severity={factor.severity} />
                </div>
              ))}
              {eq.riskFactors.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-2">No significant risk factors.</p>
              )}
            </div>
          </div>

          {/* Related Incidents */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-5">Related Incidents</h3>
            
            <div className="space-y-3">
              {eq.relatedIncidents.map(inc => (
                <div 
                  key={inc.id}
                  onClick={() => navigate(`/admin/incidents/${inc.id}`)}
                  className="block p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-slate-900">{inc.id}</span>
                    <IncidentStatusBadge status={inc.status} />
                  </div>
                  <p className="text-sm text-slate-600 truncate">{inc.issue}</p>
                  <div className="mt-2">
                    <SeverityBadge severity={inc.severity} />
                  </div>
                </div>
              ))}
              {eq.relatedIncidents.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-2">No related incidents found.</p>
              )}
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
};

export default EquipmentDetails;
