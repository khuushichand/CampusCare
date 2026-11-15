import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  FileText, Activity, AlertTriangle, CheckCircle2, AlertCircle, Loader2, RefreshCw, ArrowRight, Image as ImageIcon
} from 'lucide-react';
import { 
  getIncidents, 
  getEquipment, 
  getAlerts, 
  getReports,
  getHotspotAnalytics 
} from '../../services/api';
import clsx from 'clsx';

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  'http://127.0.0.1:8000';

const getReportImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
};

const formatDate = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recently'
    : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const StatCard = ({ title, value, icon: Icon, color, trend, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col hover:border-blue-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
    aria-label={`View ${title}`}
  >
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
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <ArrowRight className="w-4 h-4 text-slate-300" />
    </div>
  </button>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Real backend dataset states
  const [reportsData, setReportsData] = useState([]);
  const [incidentsData, setIncidentsData] = useState([]);
  const [equipmentData, setEquipmentData] = useState([]);
  const [alertsData, setAlertsData] = useState([]);
  const [hotspotsData, setHotspotsData] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const requests = await Promise.allSettled([
      getReports(),
      getIncidents(),
      getEquipment(),
      getAlerts(),
      getHotspotAnalytics(),
    ]);

    const labels = ['Reports', 'Incidents', 'Equipment', 'Alerts', 'Hotspot analytics'];
    const failures = [];

    const readList = (result, key, setter, label) => {
      if (result.status === 'rejected') {
        console.error(`Failed to fetch ${label}:`, result.reason);
        failures.push(`${label}: ${result.reason?.message || 'request failed'}`);
        return;
      }
      const value = result.value;
      const list = Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
      setter(list);
    };

    readList(requests[0], 'reports', setReportsData, labels[0]);
    readList(requests[1], 'incidents', setIncidentsData, labels[1]);
    readList(requests[2], 'equipment', setEquipmentData, labels[2]);
    readList(requests[3], 'alerts', setAlertsData, labels[3]);

    if (requests[4].status === 'fulfilled') {
      setHotspotsData(requests[4].value);
    } else {
      console.error('Failed to fetch hotspot analytics:', requests[4].reason);
      setHotspotsData(null);
      failures.push(`Hotspot analytics: ${requests[4].reason?.message || 'request failed'}`);
    }

    setErrorMessage(failures.length
      ? `Some dashboard data could not be loaded. ${failures.join(' | ')}`
      : '');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Compute live statistics directly from backend responses
  const totalReportsCount = reportsData.length;
  
  // Active incidents: status OPEN or IN_PROGRESS
  const activeIncidentsCount = incidentsData.filter(inc => {
    const s = (inc.status || '').toUpperCase();
    return s === 'OPEN' || s === 'IN_PROGRESS';
  }).length;

  // Resolved issues: status RESOLVED or CLOSED
  const resolvedIssuesCount = incidentsData.filter(inc => {
    const s = (inc.status || '').toUpperCase();
    return s === 'RESOLVED' || s === 'CLOSED';
  }).length;

  // Critical / High Risk equipment: risk_score >= 80 or status Critical / Needs Maintenance
  const criticalEquipmentCount = equipmentData.filter(eq => {
    const rScore = parseFloat(eq.risk_score || 0);
    const s = (eq.status || '').toLowerCase();
    return rScore >= 80 || s === 'critical' || s === 'needs maintenance';
  }).length;

  // Format real equipment data for high risk table (sorted by risk_score descending)
  const sortedEquipment = [...equipmentData].sort((a, b) => {
    const scoreA = parseFloat(a.risk_score || 0);
    const scoreB = parseFloat(b.risk_score || 0);
    return scoreB - scoreA;
  });

  // Calculate issue trends for last 7 days from actual reports/incidents
  const computeDailyTrends = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const past7Days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      past7Days.push({ name: dayName, dateStr, issues: 0 });
    }

    // Tally actual reports by day
    reportsData.forEach(rep => {
      if (rep.created_at) {
        const repDate = rep.created_at.split('T')[0];
        const bucket = past7Days.find(p => p.dateStr === repDate);
        if (bucket) {
          bucket.issues += 1;
        }
      }
    });

    // If stream reports had none for the week, fall back to incident created_at
    if (past7Days.every(p => p.issues === 0) && incidentsData.length > 0) {
      incidentsData.forEach(inc => {
        if (inc.created_at) {
          const incDate = inc.created_at.split('T')[0];
          const bucket = past7Days.find(p => p.dateStr === incDate);
          if (bucket) {
            bucket.issues += 1;
          }
        }
      });
    }

    return past7Days;
  };

  const chartData = computeDailyTrends();

  // Active / recent alerts (sorted newest first)
  const activeAlerts = [...alertsData].filter(a => (a.status || '').toUpperCase() === 'ACTIVE');
  const displayAlerts = (activeAlerts.length > 0 ? activeAlerts : alertsData).slice(0, 5);

  const formatAlertTime = (isoString) => {
    if (!isoString) return 'Active';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top action bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Maintenance Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time campus maintenance monitoring & issue analytics</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={isLoading}
          className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
          title="Refresh dashboard"
        >
          <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin text-blue-600")} />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-red-700 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="text-xs font-bold underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Fetching real-time data from CampusCare backend...</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Total Reports" 
              value={totalReportsCount} 
              icon={FileText} 
              color={{ bg: 'bg-blue-50', text: 'text-blue-600' }}
              onClick={() => navigate('/admin/incidents')}
            />
            <StatCard 
              title="Active Incidents" 
              value={activeIncidentsCount} 
              icon={Activity} 
              color={{ bg: 'bg-orange-50', text: 'text-orange-600' }}
              onClick={() => navigate('/admin/incidents')}
            />
            <StatCard 
              title="Critical Equipment" 
              value={criticalEquipmentCount} 
              icon={AlertTriangle} 
              color={{ bg: 'bg-red-50', text: 'text-red-600' }}
              onClick={() => navigate('/admin/risk-ranking')}
            />
            <StatCard 
              title="Resolved Issues" 
              value={resolvedIssuesCount} 
              icon={CheckCircle2} 
              color={{ bg: 'bg-green-50', text: 'text-green-600' }}
              onClick={() => navigate('/admin/incidents')}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart Area */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900">Issue Reports (Last 7 Days)</h3>
                <span className="text-xs text-slate-400 font-medium">Stream Activity</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
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
                <span className={clsx(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  activeAlerts.length > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                )}>
                  {activeAlerts.length > 0 ? `${activeAlerts.length} Active` : "None Active"}
                </span>
              </h3>
              
              <div className="space-y-5 flex-1 overflow-y-auto pr-2">
                {displayAlerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No active maintenance alerts.
                  </div>
                ) : (
                  displayAlerts.map(alert => (
                    <div key={alert.alert_id} className="flex gap-4">
                      <div className="mt-0.5">
                        <AlertCircle className={clsx(
                          "w-5 h-5 flex-shrink-0",
                          (alert.severity || '').toUpperCase() === 'CRITICAL' ? "text-red-500" : "text-orange-500"
                        )} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{alert.title}</h4>
                        <p className="text-sm text-slate-500 leading-snug mt-1">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-slate-400 font-medium">
                            {formatAlertTime(alert.created_at)}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-mono text-slate-500">
                            {alert.equipment_id}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Student Reports */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Recent Student Reports</h3>
                <p className="text-sm text-slate-500 mt-1">Latest submissions received from the student portal.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/incidents')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
              >
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {reportsData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No reports have been returned by the backend.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {[...reportsData]
                  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                  .slice(0, 5)
                  .map((report, index) => {
                    const reportId = report.report_id || report.id || `report-${index}`;
                    const imageUrl = getReportImageUrl(report.image_url);
                    return (
                      <button
                        type="button"
                        key={reportId}
                        onClick={() => navigate('/admin/incidents')}
                        className="w-full flex items-center gap-4 py-4 text-left hover:bg-slate-50 rounded-lg px-2 transition-colors"
                      >
                        {imageUrl ? (
                          <img src={imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <span className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-sm text-slate-900 truncate">
                            {report.title || report.category || 'Maintenance report'}
                          </span>
                          <span className="block text-xs text-slate-500 mt-1 truncate">
                            {report.report_id || report.id || 'Report'} · {report.location || 'Campus'} · {report.student_id || 'Student'}
                          </span>
                          <span className="block text-xs text-slate-400 mt-1">
                            {formatDate(report.created_at)}
                          </span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </button>
                    );
                  })}
              </div>
            )}
          </section>

          {/* Maintenance Hotspot Summary Bar (Phase 5) */}
          {hotspotsData && hotspotsData.summary && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Campus Hotspot Intelligence Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Most Affected Location</p>
                  <p className="text-lg font-bold text-white">
                    {hotspotsData.summary.most_affected_location || 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Most Impacted Equipment</p>
                  <p className="text-lg font-bold text-white">
                    {hotspotsData.summary.most_frequently_affected_equipment || 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Top Issue Category</p>
                  <p className="text-lg font-bold text-white">
                    {hotspotsData.summary.most_common_issue_category || 'None'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* High Risk Equipment Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Equipment Risk Assessment</h3>
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
                  {sortedEquipment.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                        No equipment records found in database.
                      </td>
                    </tr>
                  ) : (
                    sortedEquipment.map(item => {
                      const health = parseInt(item.health_score || 0, 10);
                      const risk = parseFloat(item.risk_score || 0);
                      const isCritical = risk >= 80 || (item.status || '').toLowerCase() === 'critical';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4 font-medium text-slate-900">
                            {item.name || item.type || 'Equipment'}{' '}
                            <span className="text-slate-400 font-normal font-mono">({item.id})</span>
                          </td>
                          <td className="px-4 py-4">{item.location || 'Campus'}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={clsx(
                                    "h-full rounded-full",
                                    health < 40 ? "bg-red-500" : health < 70 ? "bg-orange-500" : "bg-green-500"
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(0, health))}%` }}
                                ></div>
                              </div>
                              <span className="font-medium w-8 text-right">{health}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={clsx(
                                    "h-full rounded-full", 
                                    risk >= 80 ? "bg-red-500" : risk >= 50 ? "bg-orange-500" : "bg-green-500"
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(0, risk))}%` }}
                                ></div>
                              </div>
                              <span className="font-medium w-8 text-right text-slate-900">{risk}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={clsx(
                              "px-2.5 py-1 rounded-full text-xs font-semibold inline-block",
                              isCritical ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                            )}>
                              {item.status || (risk >= 80 ? 'Critical' : 'Operational')}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      
    </div>
  );
};

export default AdminDashboard;
