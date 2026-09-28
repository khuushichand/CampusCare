import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { Bell } from 'lucide-react';

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-campus-bg font-sans">
      <AdminSidebar />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Maintenance Overview</h2>
            <p className="text-xs text-slate-500">Monitor campus issues and equipment health</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-slate-700 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-medium text-sm">
              A
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
