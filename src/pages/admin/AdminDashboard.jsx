import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  FileText, Activity, AlertTriangle, CheckCircle2, AlertCircle
} from 'lucide-react';
import { 
  issueTrends, highRiskEquipment, recentAlerts, getReports 
} from '../../data/mockData';
import clsx from 'clsx';

const StatCard = ({ title, value, icon: Icon, color, trend }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
    <div className="flex justify-between items-start mb-4">
      <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center", color.bg)}>
        <Icon className={clsx("w-6 h-6", color.text)} />
      </div>
      {trend && (
        <span className={clsx("text-sm font-medium", trend > 0 ? "text-red-500" : "text-green-500")}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% this week
        </span>
      )}
    </div>
    <h3 className="text-3xl font-bold text-slate-900 mb-1">{value}</h3>
    <p className="text-sm font-medium text-slate-500">{title}</p>
  </div>
);

const AdminDashboard = () => {
  const reports = getReports();
  const activeIncidents = reports.filter(r => r.status !== 'Resolved').length;
  const resolvedIssues = reports.filter(r => r.status === 'Resolved').length;
  const criticalEquip = highRiskEquipment.filter(e => e.status === 'Critical').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Reports" 
          value={reports.length} 
          icon={FileText} 
          color={{ bg: 'bg-blue-50', text: 'text-blue-600' }} 
          trend={12}
        />
        <StatCard 
          title="Active Incidents" 
          value={activeIncidents} 
          icon={Activity} 
          color={{ bg: 'bg-orange-50', text: 'text-orange-600' }} 
        />
        <StatCard 
          title="Critical Equipment" 
          value={criticalEquip} 
          icon={AlertTriangle} 
          color={{ bg: 'bg-red-50', text: 'text-red-600' }} 
        />
        <StatCard 
          title="Resolved Issues" 
          value={resolvedIssues} 
          icon={CheckCircle2} 
          color={{ bg: 'bg-green-50', text: 'text-green-600' }} 
          trend={-5}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Issue Reports (Last 7 Days)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={issueTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="issues" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorIssues)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center justify-between">
            Recent Alerts
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">New</span>
          </h3>
          
          <div className="space-y-5 flex-1 overflow-y-auto pr-2">
            {recentAlerts.map(alert => (
              <div key={alert.id} className="flex gap-4">
                <div className="mt-0.5">
                  <AlertCircle className={clsx(
                    "w-5 h-5",
                    alert.severity === 'Critical' ? "text-red-500" : "text-orange-500"
                  )} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{alert.title}</h4>
                  <p className="text-sm text-slate-500 leading-snug mt-1">{alert.message}</p>
                  <p className="text-xs text-slate-400 mt-2 font-medium">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* High Risk Equipment Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6">High Risk Equipment</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-y border-slate-100">
              <tr>
                <th className="px-4 py-3 font-medium rounded-l-lg">Equipment</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium text-center">Health Score</th>
                <th className="px-4 py-3 font-medium text-center">Risk Score</th>
                <th className="px-4 py-3 font-medium rounded-r-lg">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {highRiskEquipment.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4 font-medium text-slate-900">
                    {item.type} <span className="text-slate-400 font-normal">({item.id})</span>
                  </td>
                  <td className="px-4 py-4">{item.location}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={clsx("h-full rounded-full", item.health < 40 ? "bg-red-500" : item.health < 70 ? "bg-orange-500" : "bg-green-500")}
                          style={{ width: `${item.health}%` }}
                        ></div>
                      </div>
                      <span className="font-medium w-8 text-right">{item.health}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={clsx("h-full rounded-full", item.risk > 80 ? "bg-red-500" : "bg-orange-500")}
                          style={{ width: `${item.risk}%` }}
                        ></div>
                      </div>
                      <span className="font-medium w-8 text-right text-slate-900">{item.risk}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={clsx(
                      "px-2.5 py-1 rounded-full text-xs font-semibold inline-block",
                      item.status === 'Critical' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {item.status}
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

export default AdminDashboard;
