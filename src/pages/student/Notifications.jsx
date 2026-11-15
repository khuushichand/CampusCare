import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  MessageSquare,
  Wrench,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { getMyReports } from '../../services/api';

const READ_STORAGE_KEY = 'campuscare_read_notifications';

const readStoredIds = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set();
  }
};

const getStatusDetails = (report) => {
  const status = String(report.status || report.lifecycle_status || 'Report Queued')
    .trim()
    .toLowerCase();

  if (status.includes('resolv') || status.includes('clos')) {
    return {
      title: 'Issue Resolved',
      message: `Your report ${report.id || report.report_id || ''} has been marked as resolved.`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    };
  }

  if (status.includes('progress') || status.includes('investigat') || status.includes('acknowledg')) {
    return {
      title: 'Report Update',
      message: `Your report ${report.id || report.report_id || ''} is being reviewed by the campus team.`,
      icon: Wrench,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    };
  }

  if (status.includes('reject')) {
    return {
      title: 'Report Update',
      message: `There is an update on your report ${report.id || report.report_id || ''}.`,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    };
  }

  return {
    title: 'Report Submitted',
    message: `Your report ${report.id || report.report_id || ''} has been received and is awaiting review.`,
    icon: Clock3,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  };
};

const formatTime = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';

  const elapsed = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
};

const Notifications = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [readIds, setReadIds] = useState(readStoredIds);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      setError('');
      const response = await getMyReports();
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.reports)
          ? response.reports
          : Array.isArray(response?.data?.reports)
            ? response.data.reports
            : [];

      setReports(list);
    } catch (err) {
      setError(err?.message || 'Could not load your report updates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const syncReadState = () => setReadIds(readStoredIds());
    window.addEventListener('storage', syncReadState);
    window.addEventListener('campuscare-notifications-read', syncReadState);
    return () => {
      window.removeEventListener('storage', syncReadState);
      window.removeEventListener('campuscare-notifications-read', syncReadState);
    };
  }, []);

  const notifications = useMemo(() => {
    return reports
      .map((report) => {
        const reportId = String(report.id || report.report_id || '');
        const details = getStatusDetails(report);
        const updatedAt = report.updated_at || report.created_at || report.timestamp;
        return {
          id: `report-${reportId}`,
          reportId,
          title: details.title,
          message: details.message,
          time: formatTime(updatedAt),
          read: readIds.has(`report-${reportId}`),
          icon: details.icon,
          color: details.color,
          bg: details.bg,
          sortTime: updatedAt ? new Date(updatedAt).getTime() || 0 : 0,
        };
      })
      .sort((a, b) => b.sortTime - a.sortTime);
  }, [reports, readIds]);

  const saveReadIds = (nextIds) => {
    setReadIds(nextIds);
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...nextIds]));
    window.dispatchEvent(new Event('campuscare-notifications-read'));
  };

  const markAsRead = (notificationId) => {
    const nextIds = new Set(readIds);
    nextIds.add(notificationId);
    saveReadIds(nextIds);
  };

  const markAllAsRead = () => {
    const nextIds = new Set(readIds);
    notifications.forEach((notification) => nextIds.add(notification.id));
    saveReadIds(nextIds);
  };

  const openNotification = (notification) => {
    markAsRead(notification.id);
    if (notification.reportId) {
      navigate(`/student/reports/${notification.reportId}`);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6" /> Notifications
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Updates based on the current status of your submitted reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadNotifications}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed"
          >
            Mark all as read
          </button>
        </div>
      </div>

      {unreadCount > 0 && (
        <p className="text-sm text-slate-500">{unreadCount} unread update{unreadCount === 1 ? '' : 's'}</p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading your notifications...
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              type="button"
              onClick={loadNotifications}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-700">No notifications yet</p>
            <p className="text-sm text-slate-500 mt-1">Updates about your submitted reports will appear here.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              onClick={() => openNotification(notification)}
              className={clsx(
                'w-full text-left p-6 flex items-start gap-4 transition-colors hover:bg-slate-50',
                !notification.read && 'bg-blue-50/30'
              )}
            >
              <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1', notification.bg)}>
                <notification.icon className={clsx('w-5 h-5', notification.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-4 mb-1">
                  <h3 className={clsx('font-semibold', !notification.read ? 'text-slate-900' : 'text-slate-700')}>
                    {notification.title}
                  </h3>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{notification.time}</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{notification.message}</p>
                <p className="text-xs text-blue-600 mt-2">View report</p>
              </div>

              {!notification.read && (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
