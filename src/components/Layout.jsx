import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell } from 'lucide-react';
import { user } from '../data/mockData';

const Layout = () => {
  return (
    <div className="flex min-h-screen bg-campus-bg font-sans">
      <Sidebar />
      
      <main className="flex-1 flex flex-col">
        <header className="h-16 flex items-center justify-end px-8 bg-white border-b border-slate-200">
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-slate-700 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-medium text-sm">
              {user.name.charAt(0)}
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

export default Layout;
