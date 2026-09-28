import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Bell, Settings, ArrowRight } from 'lucide-react';
import { adminAlerts } from '../../data/mockData';
import clsx from 'clsx';

const Alerts = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [alerts, setAlerts] = useState(adminAlerts);
  const [expandedAlert, setExpandedAlert] = useState(null);

  const filteredAlerts = alerts.filter(alert => filter === 'All' || alert.severity === filter);

  const toggleReadStatus = (id) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: a.status === 'Unread' ? 'Read' : 'Unread' } : a));
  };

  const getSeverityIcon = (severity) => {
    switch(severity) {
      case 'Critical': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'Warning': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          <p className="text-slate-500 mt-1">Monitor critical maintenance and equipment risk events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Alert List */}
        <div className="lg:col-span-3 space-y-6">
          
          <div className="flex items-center gap-2">
            {['All', 'Critical', 'Warning', 'Informational'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  filter === f 
                    ? "bg-slate-800 text-white" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {filteredAlerts.map(alert => {
              const isExpanded = expandedAlert === alert.id;
              
              return (
                <div key={alert.id} className={clsx("transition-colors", alert.status === 'Unread' ? 'bg-blue-50/30' : '')}>
                  <div 
                    className="p-5 flex items-start justify-between cursor-pointer hover:bg-slate-50/50"
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                  >
                    <div className="flex gap-4">
                      <div className="mt-0.5">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={clsx("font-semibold text-slate-900", alert.status === 'Unread' && "font-bold")}>
                            {alert.title}
                          </h3>
                          {alert.status === 'Unread' && (
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{alert.description}</p>
                        <p className="text-xs font-medium text-slate-400">
                          {alert.equipmentId && <span>{alert.equipmentId} • </span>}
                          {alert.location}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 text-right">
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{alert.createdAt}</span>
                      <button className="p-1 text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 ml-10 border-t border-slate-100 bg-slate-50/50">
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {alert.equipmentId && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/equipment/${alert.equipmentId}`); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" /> View Equipment
                          </button>
                        )}
                        {alert.incidentId && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/incidents/${alert.incidentId}`); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors"
                          >
                            <AlertCircle className="w-3.5 h-3.5" /> View Incident
                          </button>
                        )}
                        <div className="flex-1"></div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleReadStatus(alert.id); }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Mark as {alert.status === 'Unread' ? 'Read' : 'Unread'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredAlerts.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No alerts found matching your criteria.
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-900">Real-Time Maintenance Alerts</h3>
          </div>
          
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Critical alerts will later be generated by the backend when equipment risk scores or issue activity cross defined thresholds.
          </p>

          <div className="flex items-center gap-2 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
            <ArrowRight className="w-4 h-4" /> Redis Pub/Sub integration planned
          </div>
        </div>

      </div>
    </div>
  );
};

export default Alerts;
