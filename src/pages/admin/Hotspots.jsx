import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, AlertTriangle, Activity, ChevronRight } from 'lucide-react';
import { adminHotspots, hotspotRecentIssues } from '../../data/mockData';
import clsx from 'clsx';

const LevelBadge = ({ level }) => {
  const styles = {
    'High': 'bg-red-100 text-red-700 border-red-200',
    'Medium': 'bg-orange-100 text-orange-700 border-orange-200',
    'Low': 'bg-green-100 text-green-700 border-green-200'
  };
  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', styles[level])}>
      {level}
    </span>
  );
};

const SeverityBadge = ({ severity }) => {
  const styles = {
    'Critical': 'bg-red-100 text-red-700 border-red-200',
    'High': 'bg-orange-100 text-orange-700 border-orange-200',
    'Medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Low': 'bg-green-100 text-green-700 border-green-200'
  };
  return (
    <span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-semibold border uppercase', styles[severity])}>
      {severity}
    </span>
  );
};

const Hotspots = () => {
  const navigate = useNavigate();

  // Sort hotspots by total reports
  const maxReports = Math.max(...adminHotspots.map(h => h.totalReports));
  const activeHotspotsCount = adminHotspots.filter(h => h.level === 'High' || h.level === 'Medium').length;
  const totalReportsInHotspots = adminHotspots.reduce((acc, curr) => acc + curr.totalReports, 0);
  const totalCriticalInHotspots = adminHotspots.reduce((acc, curr) => acc + curr.criticalIssues, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Hotspots</h1>
          <p className="text-slate-500 mt-1">Identify campus locations with unusually high issue activity</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <Map className="w-4 h-4 text-blue-500" /> Powered by location-based issue frequency
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Ranked Hotspots Chart/List */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6">Location Report Volume</h3>
          
          <div className="space-y-6">
            {adminHotspots.map((hotspot, idx) => {
              const percentage = (hotspot.totalReports / maxReports) * 100;
              return (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-bold text-slate-900">{hotspot.location}</span>
                    <span className="font-medium text-slate-500">{hotspot.totalReports} reports</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          "h-full rounded-full transition-all duration-500",
                          hotspot.level === 'High' ? 'bg-red-500' :
                          hotspot.level === 'Medium' ? 'bg-orange-500' :
                          'bg-green-500'
                        )}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    
                    <div className="w-24 text-right">
                      <LevelBadge level={hotspot.level} />
                    </div>
                  </div>
                  
                  <div className="flex gap-4 text-xs font-medium text-slate-400 mt-1">
                    <span>{hotspot.activeIncidents} active</span>
                    <span>•</span>
                    <span className={hotspot.criticalIssues > 0 ? "text-red-500 font-bold" : ""}>{hotspot.criticalIssues} critical</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6">Hotspot Summary</h3>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Total Locations Monitored</p>
              <p className="text-2xl font-bold text-slate-900">12</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-orange-500"/> Active Hotspots
              </p>
              <p className="text-2xl font-bold text-slate-900">{activeHotspotsCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Reports in Hotspots</p>
              <p className="text-2xl font-bold text-slate-900">{totalReportsInHotspots}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500"/> Critical Issues in Hotspots
              </p>
              <p className="text-2xl font-bold text-slate-900">{totalCriticalInHotspots}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Issues Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Recent Issues by Location</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold">Recent Issue</th>
                <th className="px-6 py-4 font-semibold">Equipment</th>
                <th className="px-6 py-4 font-semibold">Severity</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hotspotRecentIssues.map((issue, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{issue.location}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => navigate(`/admin/incidents/${issue.id}`)}
                      className="text-blue-600 font-medium hover:text-blue-800 hover:underline"
                    >
                      {issue.issue}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => navigate(`/admin/equipment/${issue.equipmentId}`)}
                      className="text-slate-600 font-medium hover:text-slate-900 hover:underline"
                    >
                      {issue.equipment}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={issue.severity} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "font-semibold",
                      issue.status === 'Open' ? "text-purple-600" : "text-blue-600"
                    )}>
                      {issue.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
};

export default Hotspots;
