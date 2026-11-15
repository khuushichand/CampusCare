import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Bell,
  ArrowRight,
  Loader2,
  RefreshCw,
  Settings,
  Search,
  X,
} from 'lucide-react';
import clsx from 'clsx';

import { getAlerts, updateAlertStatus } from '../../services/api';


// ==================================================
// HELPERS
// ==================================================

/**
 * Formats an ISO timestamp for display.
 * Falls back to the raw string if parsing fails.
 */
const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

/**
 * Capitalise first letter, lower the rest.
 */
const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '—';


// ==================================================
// SEVERITY ICON
// Backend severities: CRITICAL, HIGH, MEDIUM, LOW
// ==================================================

const getSeverityIcon = (severity) => {
  const s = String(severity || '').toUpperCase();
  if (s === 'CRITICAL') {
    return <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
  }
  if (s === 'HIGH') {
    return <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />;
  }
  return <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />;
};


// ==================================================
// SEVERITY BADGE
// ==================================================

const SeverityBadge = ({ severity }) => {
  const s = String(severity || '').toUpperCase();
  const styles = {
    CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    LOW: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        styles[s] || 'bg-slate-100 text-slate-600 border-slate-200'
      )}
    >
      {capitalize(severity)}
    </span>
  );
};


// ==================================================
// STATUS BADGE
// ==================================================

const StatusBadge = ({ status }) => {
  const s = String(status || '').toUpperCase();
  const styles = {
    ACTIVE: 'bg-blue-100 text-blue-700 border-blue-200',
    RESOLVED: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        styles[s] || 'bg-slate-100 text-slate-600 border-slate-200'
      )}
    >
      {capitalize(status)}
    </span>
  );
};


// ==================================================
// FILTER TABS
// All / CRITICAL / HIGH / ACTIVE / RESOLVED
// ==================================================

const FILTER_TABS = ['All', 'CRITICAL', 'HIGH', 'ACTIVE', 'RESOLVED'];

const matchesFilter = (alert, filter) => {
  if (filter === 'All') return true;
  const sev = String(alert.severity || '').toUpperCase();
  const sta = String(alert.status || '').toUpperCase();
  if (filter === 'CRITICAL') return sev === 'CRITICAL';
  if (filter === 'HIGH') return sev === 'HIGH';
  if (filter === 'ACTIVE') return sta === 'ACTIVE';
  if (filter === 'RESOLVED') return sta === 'RESOLVED';
  return true;
};

const filterLabel = (f) => {
  if (f === 'All') return 'All';
  return capitalize(f);
};


// ==================================================
// ALERTS PAGE
// ==================================================

const Alerts = () => {
  const navigate = useNavigate();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAlert, setExpandedAlert] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Track in-progress status updates per alert_id
  const [updating, setUpdating] = useState({});
  const [updateErrors, setUpdateErrors] = useState({});


  // --------------------------------------------------
  // LOAD ALERTS
  // --------------------------------------------------

  /**
   * GET /api/alerts → { count, alerts: [{ alert_id, equipment_id, title,
   *                     message, severity, status, created_at }] }
   */
  const loadAlerts = useCallback(async () => {
    try {
      setRefreshing(true);
      setError('');

      const data = await getAlerts();
      const receivedAlerts = Array.isArray(data)
        ? data
        : Array.isArray(data?.alerts)
          ? data.alerts
          : [];

      // Keep active alerts first, then sort each group newest-first.
      const list = receivedAlerts.slice().sort((a, b) => {
        const aActive = String(a?.status || '').toUpperCase() === 'ACTIVE' ? 0 : 1;
        const bActive = String(b?.status || '').toUpperCase() === 'ACTIVE' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
      });

      setAlerts(list);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setError(err.message || 'Failed to load alerts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);


  // --------------------------------------------------
  // FILTER
  // --------------------------------------------------

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredAlerts = alerts.filter((alert) => {
    if (!matchesFilter(alert, filter)) return false;
    if (!normalizedSearch) return true;
    return [
      alert.title,
      alert.message,
      alert.alert_id,
      alert.equipment_id,
      alert.severity,
      alert.status,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
  });


  // --------------------------------------------------
  // STATUS UPDATE
  // --------------------------------------------------

  /**
   * PATCH /api/alerts/{alert_id}/status
   * Body: { "status": "ACTIVE" | "RESOLVED" }
   * On success → patch that alert in-place (no full reload needed).
   */
  const handleToggleStatus = async (e, alert) => {
    e.stopPropagation();

    const alertId = alert.alert_id;
    const currentStatus = String(alert.status || '').toUpperCase();
    const nextStatus = currentStatus === 'ACTIVE' ? 'RESOLVED' : 'ACTIVE';

    // Prevent duplicate requests
    if (updating[alertId]) return;

    setUpdating((prev) => ({ ...prev, [alertId]: true }));
    setUpdateErrors((prev) => ({ ...prev, [alertId]: '' }));

    try {
      const result = await updateAlertStatus(alertId, nextStatus);

      // Some API responses return only the changed status. Preserve the
      // existing alert fields when merging that partial response.
      const responseAlert = result?.alert || result || {};
      const updatedAlert = { ...alert, ...responseAlert, status: responseAlert.status || nextStatus };
      setAlerts((prev) =>
        prev
          .map((item) => item.alert_id === alertId ? updatedAlert : item)
          .sort((a, b) => {
            const aActive = String(a?.status || '').toUpperCase() === 'ACTIVE' ? 0 : 1;
            const bActive = String(b?.status || '').toUpperCase() === 'ACTIVE' ? 0 : 1;
            if (aActive !== bActive) return aActive - bActive;
            return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
          })
      );
    } catch (err) {
      console.error('Failed to update alert status:', err);
      setUpdateErrors((prev) => ({
        ...prev,
        [alertId]: err.message || 'Update failed',
      }));
    } finally {
      setUpdating((prev) => ({ ...prev, [alertId]: false }));
    }
  };


  // --------------------------------------------------
  // COUNTS (for filter tab badges)
  // --------------------------------------------------

  const countFor = (f) => {
    if (f === 'All') return alerts.length;
    return alerts.filter((a) => matchesFilter(a, f)).length;
  };


  // --------------------------------------------------
  // RENDER — LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p>Loading alerts…</p>
      </div>
    );
  }


  // --------------------------------------------------
  // RENDER — ERROR
  // --------------------------------------------------

  if (error && alerts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
          <h2 className="font-bold text-lg mb-2">Failed to load alerts</h2>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={loadAlerts}
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
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          <p className="text-slate-500 mt-1">
            Monitor critical maintenance and equipment risk events
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-1">
          <button
            onClick={loadAlerts}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-60 self-start md:self-auto"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {lastUpdated && (
            <span className="text-[11px] text-slate-400">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>


      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error} Showing the last successfully loaded results.</span>
          <button onClick={loadAlerts} className="font-semibold hover:underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ================================================
            MAIN ALERT LIST
        ================================================ */}

        <div className="lg:col-span-3 space-y-4">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search alerts by title, equipment ID, message..."
              aria-label="Search alerts"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear alert search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5',
                  filter === f
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                )}
              >
                {filterLabel(f)}
                <span
                  className={clsx(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    filter === f
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {countFor(f)}
                </span>
              </button>
            ))}
          </div>

          {/* Alert list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

            {filteredAlerts.map((alert) => {
              const alertId = alert.alert_id;
              const isExpanded = expandedAlert === alertId;
              const isActive =
                String(alert.status || '').toUpperCase() === 'ACTIVE';
              const isUpdating = !!updating[alertId];
              const updateErr = updateErrors[alertId];

              return (
                <div
                  key={alertId}
                  className={clsx(
                    'transition-colors',
                    isActive ? 'bg-blue-50/30' : ''
                  )}
                >
                  {/* Alert row */}
                  <div
                    className="p-5 flex items-start justify-between cursor-pointer hover:bg-slate-50/50"
                    onClick={() =>
                      setExpandedAlert(isExpanded ? null : alertId)
                    }
                  >
                    <div className="flex gap-4">
                      <div className="mt-0.5">
                        {getSeverityIcon(alert.severity)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3
                            className={clsx(
                              'font-semibold text-slate-900',
                              isActive && 'font-bold'
                            )}
                          >
                            {alert.title}
                          </h3>

                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                          )}

                          <SeverityBadge severity={alert.severity} />
                          <StatusBadge status={alert.status} />
                        </div>

                        <p className="text-sm text-slate-600 mb-1">
                          {alert.message}
                        </p>

                        <p className="text-xs font-medium text-slate-400">
                          {alert.equipment_id && (
                            <span>{alert.equipment_id} • </span>
                          )}
                          {formatDate(alert.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-right ml-4 flex-shrink-0">
                      <button type="button" aria-label={isExpanded ? "Collapse alert details" : "Expand alert details"} className="p-1 text-slate-400 hover:text-slate-600">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 ml-10 border-t border-slate-100 bg-slate-50/50">

                      {/* Update error */}
                      {updateErr && (
                        <p className="text-xs text-red-600 mb-3">
                          {updateErr}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-2">

                        {/* Navigate to equipment */}
                        {alert.equipment_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/admin/equipment/${alert.equipment_id}`
                              );
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            View Equipment
                          </button>
                        )}

                        <div className="flex-1" />

                        {/* Toggle ACTIVE / RESOLVED */}
                        <button
                          onClick={(e) => handleToggleStatus(e, alert)}
                          disabled={isUpdating}
                          className={clsx(
                            'text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                            isActive
                              ? 'text-green-600 hover:text-green-800'
                              : 'text-blue-600 hover:text-blue-800'
                          )}
                        >
                          {isUpdating
                            ? 'Updating…'
                            : isActive
                              ? 'Mark as Resolved'
                              : 'Mark as Active'}
                        </button>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty state */}
            {filteredAlerts.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                {alerts.length === 0
                  ? 'No alerts generated yet. Alerts are created automatically when equipment risk scores exceed the configured threshold.'
                  : normalizedSearch
                    ? 'No alerts match your search and selected filter.'
                    : 'No alerts matching the selected filter.'}
              </div>
            )}

          </div>
        </div>


        {/* ================================================
            INFO CARD
        ================================================ */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit space-y-6">

          {/* Real-time alerts info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Bell className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900">
                Equipment Risk Alerts
              </h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Alerts are generated automatically when an equipment's
              risk score crosses the configured threshold. They remain
              active until resolved.
            </p>

            <div className="flex items-center gap-2 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
              <ArrowRight className="w-4 h-4" />
              Redis Pub/Sub integration active
            </div>
          </div>

          {/* Summary counts */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Summary
            </h4>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Critical
              </span>
              <span className="font-bold text-slate-900">
                {alerts.filter(
                  (a) =>
                    String(a.severity || '').toUpperCase() === 'CRITICAL'
                ).length}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                High
              </span>
              <span className="font-bold text-slate-900">
                {alerts.filter(
                  (a) =>
                    String(a.severity || '').toUpperCase() === 'HIGH'
                ).length}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-500 inline-block" />
                Active
              </span>
              <span className="font-bold text-slate-900">
                {alerts.filter(
                  (a) =>
                    String(a.status || '').toUpperCase() === 'ACTIVE'
                ).length}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-green-500 inline-block" />
                Resolved
              </span>
              <span className="font-bold text-slate-900">
                {alerts.filter(
                  (a) =>
                    String(a.status || '').toUpperCase() === 'RESOLVED'
                ).length}
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Alerts;
