import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { adminRiskRanking } from '../../data/mockData';
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

const RiskRanking = () => {
  const navigate = useNavigate();
  
  const highRiskCount = adminRiskRanking.filter(e => e.status === 'High Risk' || e.status === 'Critical').length;
  const warningCount = adminRiskRanking.filter(e => e.status === 'Warning').length;
  const healthyCount = adminRiskRanking.filter(e => e.status === 'Healthy').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Risk Ranking
          </h1>
          <p className="text-slate-500 mt-1">Prioritize equipment based on health, failures and recent complaints</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <Activity className="w-4 h-4 text-purple-500" /> Powered by equipment risk scores
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        
        {/* Explanatory Card */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" /> How Risk is Calculated
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {['Historical failures', 'Recent complaint frequency', 'Equipment age', 'Downtime', 'Incident severity'].map((factor, idx) => (
              <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600">{factor}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500"/> High Risk / Critical</span>
              <span className="font-bold text-slate-900">{highRiskCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2"><Activity className="w-4 h-4 text-orange-500"/> Warning</span>
              <span className="font-bold text-slate-900">{warningCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Healthy</span>
              <span className="font-bold text-slate-900">{healthyCount}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Ranked Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-center w-16">Rank</th>
                <th className="px-6 py-4 font-semibold">Equipment</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold text-center">Health Score</th>
                <th className="px-6 py-4 font-semibold text-center">Risk Score</th>
                <th className="px-6 py-4 font-semibold text-center">Recent Reports</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adminRiskRanking.map((eq, index) => {
                const rank = index + 1;
                return (
                  <tr 
                    key={eq.id} 
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/admin/equipment/${eq.id}`)}
                  >
                    <td className="px-6 py-4 font-bold text-center">
                      <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center mx-auto",
                        rank <= 3 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                      )}>
                        {rank}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {eq.name} <span className="text-slate-400 font-normal ml-1">({eq.id})</span>
                    </td>
                    <td className="px-6 py-4">{eq.type}</td>
                    <td className="px-6 py-4">{eq.location}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className={clsx("font-semibold w-8 text-right", eq.healthScore >= 70 ? "text-green-600" : eq.healthScore >= 40 ? "text-orange-500" : "text-red-600")}>
                          {eq.healthScore}%
                        </span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={clsx("h-full rounded-full", eq.healthScore >= 70 ? "bg-green-500" : eq.healthScore >= 40 ? "bg-orange-500" : "bg-red-500")}
                            style={{ width: `${eq.healthScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className={clsx("font-semibold w-8 text-right", eq.riskScore >= 70 ? "text-red-600" : eq.riskScore >= 40 ? "text-orange-500" : "text-green-600")}>
                          {eq.riskScore}
                        </span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={clsx("h-full rounded-full", eq.riskScore >= 70 ? "bg-red-500" : eq.riskScore >= 40 ? "bg-orange-500" : "bg-green-500")}
                            style={{ width: `${eq.riskScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-center text-slate-900">{eq.recentReports}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={eq.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/equipment/${eq.id}`); }}
                        className="text-blue-600 font-medium hover:text-blue-800 flex items-center justify-end gap-1 w-full"
                      >
                        View Details <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RiskRanking;
