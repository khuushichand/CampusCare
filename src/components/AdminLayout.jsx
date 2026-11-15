import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { Bell, AlertTriangle, CheckCircle, Clock3, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { getAlerts } from '../services/api';
import clsx from 'clsx';

const getAlertList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.alerts)) return response.alerts;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
};

const getAlertId = (alert, index) =>
  alert?.id ?? alert?.alert_id ?? alert?._id ?? `alert-${index}`;

const getAlertTitle = (alert) =>
  alert?.title || alert?.name || alert?.equipment_name || 'Campus alert';

const getAlertMessage = (alert) =>
  alert?.message || alert?.description || alert?.details || 'An alert needs your attention.';

const getAlertStatus = (alert) =>
  String(alert?.status || 'Active').toLowerCase();

const formatAlertTime = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const AdminLayout = () => {
  const navigate = useNavigate();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertError, setAlertError] = useState('');
  const [lastFetched, setLastFetched] = useState(null);
  const notificationRef = useRef(null);

  const fetchAlerts = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoadingAlerts(true);
    try {
      const response = await getAlerts();
      setAlerts(getAlertList(response));
      setAlertError('');
      setLastFetched(new Date());
    } catch (error) {
      setAlertError(error?.message || 'Could not load notifications.');
    } finally {
      if (showLoader) setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts({ showLoader: true });
    // Keep the notification count reasonably current while the admin portal is open.
    const intervalId = window.setInterval(() => fetchAlerts(), 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchAlerts]);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;

    const handlePointerDown = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsNotificationsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationsOpen]);

  const activeAlerts = alerts.filter((alert) => {
    const status = getAlertStatus(alert);
    return !['resolved', 'closed', 'dismissed', 'completed'].includes(status);
  });

  const openAlertsPage = () => {
    setIsNotificationsOpen(false);
    navigate('/admin/alerts');
  };

  const handleNotificationClick = (alert) => {
    setIsNotificationsOpen(false);
    // The alert list is the reliable destination because alert detail routing
    // is not defined in the current frontend routes.
    navigate('/admin/alerts', {
      state: { selectedAlertId: alert?.id ?? alert?.alert_id ?? alert?._id ?? null },
    });
  };

  return (
    <div className="flex min-h-screen bg-campus-bg font-sans">
      <AdminSidebar />

      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 sm:px-8 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Maintenance Overview</h2>
            <p className="text-xs text-slate-500">
              Monitor campus issues and equipment health
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => {
                  setIsNotificationsOpen((open) => !open);
                  if (!isNotificationsOpen) fetchAlerts({ showLoader: true });
                }}
                aria-label={`Notifications, ${activeAlerts.length} active`}
                aria-expanded={isNotificationsOpen}
                aria-haspopup="dialog"
                className={clsx(
                  'p-2 rounded-xl transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  isNotificationsOpen
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                )}
              >
                <Bell className="w-5 h-5" />
                {activeAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white">
                    {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications"
                  className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-900">Notifications</h3>
                      <p className="text-xs text-slate-500">
                        {activeAlerts.length} active {activeAlerts.length === 1 ? 'alert' : 'alerts'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => fetchAlerts({ showLoader: true })}
                        disabled={loadingAlerts}
                        aria-label="Refresh notifications"
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {loadingAlerts ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNotificationsOpen(false)}
                        aria-label="Close notifications"
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {alertError && (
                    <div className="px-4 py-3 text-xs text-red-700 bg-red-50 border-b border-red-100">
                      {alertError}
                      <button
                        type="button"
                        onClick={() => fetchAlerts({ showLoader: true })}
                        className="ml-2 font-semibold underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div className="max-h-80 overflow-y-auto">
                    {loadingAlerts && alerts.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading alerts...
                      </div>
                    ) : activeAlerts.length === 0 ? (
                      <div className="px-5 py-8 text-center">
                        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-800">You're all caught up</p>
                        <p className="text-xs text-slate-500 mt-1">
                          No active alerts at the moment.
                        </p>
                      </div>
                    ) : (
                      activeAlerts.slice(0, 8).map((alert, index) => {
                        const severity = String(
                          alert?.severity || alert?.priority || 'notice'
                        ).toLowerCase();
                        const isCritical = ['critical', 'high', 'urgent'].includes(severity);
                        const timestamp =
                          alert?.created_at || alert?.timestamp || alert?.updated_at;

                        return (
                          <button
                            type="button"
                            key={getAlertId(alert, index)}
                            onClick={() => handleNotificationClick(alert)}
                            className="w-full text-left flex gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                          >
                            <span
                              className={clsx(
                                'mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                                isCritical
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-amber-50 text-amber-600'
                              )}
                            >
                              {isCritical ? (
                                <AlertTriangle className="w-4 h-4" />
                              ) : (
                                <Bell className="w-4 h-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900 line-clamp-1">
                                  {getAlertTitle(alert)}
                                </span>
                                <span
                                  className={clsx(
                                    'text-[10px] uppercase font-bold shrink-0',
                                    isCritical ? 'text-red-600' : 'text-amber-600'
                                  )}
                                >
                                  {severity}
                                </span>
                              </span>
                              <span className="block text-xs text-slate-500 mt-1 line-clamp-2">
                                {getAlertMessage(alert)}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
                                <Clock3 className="w-3 h-3" />
                                {formatAlertTime(timestamp)}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={openAlertsPage}
                      className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      View all alerts <ExternalLink className="w-4 h-4" />
                    </button>
                    {lastFetched && (
                      <p className="text-center text-[10px] text-slate-400 mt-1">
                        Updated {lastFetched.toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin/profile')}
              aria-label="Open admin profile"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            >
              A
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
