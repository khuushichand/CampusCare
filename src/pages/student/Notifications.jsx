import React from 'react';
import { Bell, MessageSquare, Wrench, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

const notifications = [
  {
    id: 1,
    type: 'status',
    title: 'Report Acknowledged',
    message: 'Your report INC-104 has been acknowledged by the admin team.',
    time: '2 hours ago',
    read: false,
    icon: MessageSquare,
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    id: 2,
    type: 'maintenance',
    title: 'Maintenance Update',
    message: 'Maintenance team is reviewing Projector P001.',
    time: '1 day ago',
    read: true,
    icon: Wrench,
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    id: 3,
    type: 'resolved',
    title: 'Issue Resolved',
    message: 'Your reported issue regarding WiFi in Block A has been resolved.',
    time: '2 days ago',
    read: true,
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50'
  }
];

const Notifications = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notifications
        </h1>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {notifications.map((notif) => (
          <div 
            key={notif.id} 
            className={clsx(
              "p-6 flex items-start gap-4 transition-colors hover:bg-slate-50 cursor-pointer",
              !notif.read && "bg-blue-50/30"
            )}
          >
            <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1", notif.bg)}>
              <notif.icon className={clsx("w-5 h-5", notif.color)} />
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className={clsx("font-semibold", !notif.read ? "text-slate-900" : "text-slate-700")}>
                  {notif.title}
                </h3>
                <span className="text-xs text-slate-400 whitespace-nowrap ml-4">{notif.time}</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                {notif.message}
              </p>
            </div>
            
            {!notif.read && (
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
