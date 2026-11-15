import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, CheckCircle2, Clock3, Wrench, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { user } from '../data/mockData';
import { getMyReports } from '../services/api';

const READ_STORAGE_KEY = 'campuscare_read_notifications';

const getReadIds = () => {
  try {
    const value = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
};

const getNotificationDetails = (report) => {
  const status = String(report.status || report.lifecycle_status || 'Report Queued').toLowerCase();
  const reportId = String(report.id || report.report_id || '');

  if (status.includes('resolv') || status.includes('clos')) {
    return {
      title: 'Issue Resolved',
      message: `Your report ${reportId} has been marked as resolved.`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    };
  }

  if (status.includes('progress') || status.includes('investigat') || status.includes('acknowledg')) {
    return {
      title: 'Report Update',
      message: `Your report ${reportId} is being reviewed by the campus team.`,
      icon: Wrench,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    };
  }

  if (status.includes('reject')) {
    return {
      title: 'Report Update',
      message: `There is an update on your report ${reportId}.`,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    };
  }

  return {
    title: 'Report Submitted',
    message: `Your report ${reportId} has been received and is awaiting review.`,
    icon: Clock3,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  };
};

const formatNotificationTime = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getCurrentUserName = () => {
  try {
    const savedUser = JSON.parse(localStorage.getItem('campuscare_user') || 'null');
    return savedUser?.name || user.name || 'U';
  } catch {
    return user.name || 'U';
  }
};

const Layout = () => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    setNotificationError('');
    try {
      const response = await getMyReports();
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.reports)
          ? response.reports
          : Array.isArray(response?.data?.reports)
            ? response.data.reports
            : [];
      setReports(list);
    } catch (error) {
      setNotificationError(error?.message || 'Could not load notifications.');
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    const syncReadState = () => setReadIds(getReadIds());
    window.addEventListener('storage', syncReadState);
    window.addEventListener('campuscare-notifications-read', syncReadState);
    return () => {
      window.removeEventListener('storage', syncReadState);
      window.removeEventListener('campuscare-notifications-read', syncReadState);
    };
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const notifications = useMemo(() => reports.map((report) => {
    const reportId = String(report.id || report.report_id || '');
    const details = getNotificationDetails(report);
    const updatedAt = report.updated_at || report.created_at || report.timestamp;
    return {
      id: `report-${reportId}`,
      reportId,
      ...details,
      time: formatNotificationTime(updatedAt),
      read: readIds.has(`report-${reportId}`),
      sortTime: updatedAt ? new Date(updatedAt).getTime() || 0 : 0,
    };
  }).sort((a, b) => b.sortTime - a.sortTime), [reports, readIds]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const saveReadIds = (nextIds) => {
    setReadIds(nextIds);
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...nextIds]));
    window.dispatchEvent(new Event('campuscare-notifications-read'));
  };

  const markAllAsRead = () => {
    const nextIds = new Set(readIds);
    notifications.forEach((item) => nextIds.add(item.id));
    saveReadIds(nextIds);
  };

  const openNotification = (notification) => {
    const nextIds = new Set(readIds);
    nextIds.add(notification.id);
    saveReadIds(nextIds);
    setIsOpen(false);
    navigate(`/student/reports/${notification.reportId}`);
  };

  const toggleDropdown = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) loadNotifications();
  };

  return (
    <div className="flex min-h-screen bg-campus-bg font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-end px-8 bg-white border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={toggleDropdown}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={isOpen}
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-semibold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">Notifications</h3>
                      <p className="text-xs text-slate-500">
                        {unreadCount} unread update{unreadCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      disabled={unreadCount === 0}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-300"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {loadingNotifications ? (
                      <div className="p-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </div>
                    ) : notificationError ? (
                      <div className="p-5 text-sm text-red-600">{notificationError}</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => openNotification(notification)}
                          className={clsx(
                            'w-full p-4 text-left flex gap-3 hover:bg-slate-50 transition-colors',
                            !notification.read && 'bg-blue-50/40'
                          )}
                        >
                          <span className={clsx('w-9 h-9 rounded-full flex items-center justify-center shrink-0', notification.bg)}>
                            <notification.icon className={clsx('w-4 h-4', notification.color)} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-800">{notification.title}</span>
                              {!notification.read && <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />}
                            </span>
                            <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{notification.message}</span>
                            <span className="block text-[11px] text-slate-400 mt-2">{notification.time}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/student/notifications');
                    }}
                    className="w-full px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-slate-50 border-t border-slate-100"
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/student/profile')}
              aria-label="Open profile"
              title="Profile"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-medium text-sm hover:ring-4 hover:ring-blue-100 transition-all focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              {getCurrentUserName().charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
