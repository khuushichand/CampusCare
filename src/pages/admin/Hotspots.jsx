import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map,
  AlertTriangle,
  Activity,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';

import { getHotspotAnalytics } from '../../services/api';


// ==================================================
// HELPERS
// ==================================================

/**
 * Derive a display level from the backend's authoritative priority_score.
 * Thresholds chosen to match the [0–100] bounded score from the service.
 */
const getLevelFromScore = (priorityScore) => {
  const score = Number(priorityScore ?? 0);
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
};

/** Capitalise the first letter; leave the rest as-is. */
const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '—';

/** Derive display severity label from a severity_distribution object. */
const dominantSeverity = (dist) => {
  if (!dist) return 'Medium';
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    if ((dist[sev] ?? 0) > 0) return capitalize(sev);
  }
  return 'Medium';
};


// ==================================================
// BADGES
// ==================================================

const LevelBadge = ({ level }) => {
  const styles = {
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-orange-100 text-orange-700 border-orange-200',
    Low: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-full text-xs font-semibold border',
        styles[level] || 'bg-slate-100 text-slate-700 border-slate-200'
      )}
    >
      {level}
    </span>
  );
};

const SeverityBadge = ({ severity }) => {
  const styles = {
    Critical: 'bg-red-100 text-red-700 border-red-200',
    High: 'bg-orange-100 text-orange-700 border-orange-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Low: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-full text-[10px] font-semibold border uppercase',
        styles[severity] || 'bg-slate-100 text-slate-700 border-slate-200'
      )}
    >
      {severity}
    </span>
  );
};


// ==================================================
// HOTSPOTS PAGE
// ==================================================

const Hotspots = () => {
  const navigate = useNavigate();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [locationHotspots, setLocationHotspots] = useState([]);
  const [equipmentHotspots, setEquipmentHotspots] = useState([]);
  const [categoryHotspots, setCategoryHotspots] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');


  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  /**
   * GET /api/analytics/hotspots
   *
   * Response shape:
   * {
   *   location_hotspots:  [{ location, incident_count, report_count,
   *                          severity_distribution, is_recurring, priority_score }]
   *   equipment_hotspots: [{ equipment_id, equipment_name, equipment_type,
   *                          location, status, health_score, failure_count,
   *                          incident_count, report_count,
   *                          severity_distribution, is_recurring, priority_score }]
   *   category_hotspots:  [{ category, incident_count, report_count,
   *                          severity_distribution, priority_score }]
   *   summary: {
   *     total_incidents_analyzed, total_reports_represented,
   *     most_affected_location, most_frequently_affected_equipment,
   *     most_common_issue_category
   *   }
   * }
   */
  const loadData = useCallback(async () => {
    const isFirstLoad = !hasLoadedRef.current;

    try {
      if (isFirstLoad) {
        setLoading(true);
        setError('');
      } else {
        setRefreshing(true);
        setRefreshError('');
      }

      const response = await getHotspotAnalytics();
      const data = response?.data || response || {};
      const asArray = (value) => (Array.isArray(value) ? value : []);

      setLocationHotspots(asArray(data.location_hotspots));
      setEquipmentHotspots(asArray(data.equipment_hotspots));
      setCategoryHotspots(asArray(data.category_hotspots));
      setSummary(data.summary && typeof data.summary === 'object' ? data.summary : null);
      setLastRefreshed(new Date());
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to load hotspot analytics:', err);

      if (isFirstLoad) {
        setError(err.message || 'Failed to load hotspot analytics.');
      } else {
        setRefreshError(err.message || 'Could not refresh hotspot analytics. Showing the last loaded data.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // --------------------------------------------------
  // DERIVED SUMMARY VALUES
  // --------------------------------------------------

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const maxReports =
    locationHotspots.length > 0
      ? Math.max(...locationHotspots.map((h) => toNumber(h.report_count)))
      : 1; // avoid division by zero

  const activeHotspotsCount = locationHotspots.filter((h) => {
    const level = getLevelFromScore(h.priority_score);
    return level === 'High' || level === 'Medium';
  }).length;

  const totalCriticalInHotspots = locationHotspots.reduce(
    (acc, h) => acc + toNumber(h.severity_distribution?.CRITICAL),
    0
  );


  // --------------------------------------------------
  // RENDER — LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p>Loading hotspot analytics…</p>
      </div>
    );
  }


  // --------------------------------------------------
  // RENDER — ERROR
  // --------------------------------------------------

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
          <h2 className="font-bold text-lg mb-2">
            Failed to load hotspot analytics
          </h2>

          <p className="text-sm mb-4">{error}</p>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }


  // --------------------------------------------------
  // RENDER — MAIN
  // --------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ================================================
          HEADER
      ================================================ */}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Maintenance Hotspots
          </h1>

          <p className="text-slate-500 mt-1">
            Identify campus locations with unusually high issue activity
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-400">
            {lastRefreshed
              ? `Last updated ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Not yet refreshed'}
          </div>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RotateCcw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <Map className="w-4 h-4 text-blue-500" />
            Powered by location-based issue frequency
          </div>
        </div>
      </div>


      {refreshError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          {refreshError}
        </div>
      )}

      {/* ================================================
          LOCATION CHART + SUMMARY CARDS
      ================================================ */}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Location Report Volume Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6">
            Location Report Volume
          </h3>

          {locationHotspots.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">
              No location data available yet.
            </p>
          ) : (
            <div className="space-y-6">
              {locationHotspots.map((hotspot, idx) => {
                const level = getLevelFromScore(hotspot.priority_score);
                const reportCount = toNumber(hotspot.report_count);
                const percentage = maxReports > 0
                  ? (reportCount / maxReports) * 100
                  : 0;
                const criticalCount = toNumber(hotspot.severity_distribution?.CRITICAL);

                return (
                  <div key={idx} className="flex flex-col gap-2">

                    <div className="flex justify-between items-end text-sm">
                      <span className="font-bold text-slate-900 flex items-center gap-2">
                        {hotspot.location}
                        {hotspot.is_recurring && (
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase">
                            Recurring
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-slate-500">
                        {reportCount} report{reportCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all duration-500',
                            level === 'High'
                              ? 'bg-red-500'
                              : level === 'Medium'
                                ? 'bg-orange-500'
                                : 'bg-green-500'
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                        />
                      </div>

                      <div className="w-24 text-right">
                        <LevelBadge level={level} />
                      </div>
                    </div>

                    <div className="flex gap-4 text-xs font-medium text-slate-400 mt-1">
                      <span>{toNumber(hotspot.incident_count)} incident{toNumber(hotspot.incident_count) !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span
                        className={
                          criticalCount > 0
                            ? 'text-red-500 font-bold'
                            : ''
                        }
                      >
                        {criticalCount} critical
                      </span>
                      <span>•</span>
                      <span className="text-slate-500">
                        Priority: {hotspot.priority_score}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>


        {/* Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6">Hotspot Summary</h3>

          <div className="space-y-6">

            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">
                Total Locations Monitored
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {locationHotspots.length}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-orange-500" />
                Active Hotspots
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {activeHotspotsCount}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">
                Reports in Hotspots
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.total_reports_represented ?? 0}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Critical Issues in Hotspots
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {totalCriticalInHotspots}
              </p>
            </div>

            {summary?.most_common_issue_category && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Top Issue Category
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {capitalize(summary.most_common_issue_category)}
                </p>
              </div>
            )}

          </div>
        </div>

      </div>


      {/* ================================================
          EQUIPMENT HOTSPOTS TABLE
          Replaces the mock "Recent Issues" table with real
          per-equipment hotspot data from the backend.
      ================================================ */}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">
            Equipment Hotspots
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Equipment ranked by maintenance priority score
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">

            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Equipment</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold">Incidents</th>
                <th className="px-6 py-4 font-semibold">Reports</th>
                <th className="px-6 py-4 font-semibold">Dominant Severity</th>
                <th className="px-6 py-4 font-semibold text-center">Recurring</th>
                <th className="px-6 py-4 font-semibold text-right">Priority</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {equipmentHotspots.map((eq, idx) => {
                const domSev = dominantSeverity(eq.severity_distribution);

                return (
                  <tr
                    key={eq.equipment_id || idx}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() =>
                      navigate(`/admin/equipment/${eq.equipment_id}`)
                    }
                  >

                    {/* EQUIPMENT */}
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">
                        {eq.equipment_name || eq.equipment_id}
                      </span>
                      {eq.equipment_type && (
                        <span className="text-slate-400 font-normal ml-1 text-xs">
                          ({eq.equipment_type})
                        </span>
                      )}
                    </td>

                    {/* LOCATION */}
                    <td className="px-6 py-4">
                      {eq.location || '—'}
                    </td>

                    {/* INCIDENT COUNT */}
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {toNumber(eq.incident_count)}
                    </td>

                    {/* REPORT COUNT */}
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {toNumber(eq.report_count)}
                    </td>

                    {/* DOMINANT SEVERITY */}
                    <td className="px-6 py-4">
                      <SeverityBadge severity={domSev} />
                    </td>

                    {/* RECURRING */}
                    <td className="px-6 py-4 text-center">
                      {eq.is_recurring ? (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded uppercase">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* PRIORITY SCORE */}
                    <td className="px-6 py-4 text-right">
                      <span
                        className={clsx(
                          'font-bold',
                          eq.priority_score >= 60
                            ? 'text-red-600'
                            : eq.priority_score >= 30
                              ? 'text-orange-500'
                              : 'text-green-600'
                        )}
                      >
                        {toNumber(eq.priority_score)}
                      </span>
                    </td>

                  </tr>
                );
              })}

              {/* EMPTY STATE */}
              {equipmentHotspots.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No equipment hotspot data available yet.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>


      {/* ================================================
          CATEGORY HOTSPOTS
      ================================================ */}

      {categoryHotspots.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6">
            Issue Categories
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryHotspots.map((cat, idx) => {
              const level = getLevelFromScore(cat.priority_score);

              return (
                <div
                  key={idx}
                  className="bg-slate-50 rounded-xl border border-slate-100 p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-slate-900 text-sm">
                      {capitalize(cat.category)}
                    </span>
                    <LevelBadge level={level} />
                  </div>

                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>
                      <span className="font-semibold text-slate-700">
                        {toNumber(cat.incident_count)}
                      </span>{' '}
                      incident{cat.incident_count !== 1 ? 's' : ''}
                    </span>

                    <span>
                      <span className="font-semibold text-slate-700">
                        {toNumber(cat.report_count)}
                      </span>{' '}
                      report{cat.report_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    Priority: {toNumber(cat.priority_score)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default Hotspots;
