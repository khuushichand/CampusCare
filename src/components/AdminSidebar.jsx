import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Settings, 
  Bell, 
  User, 
  LogOut,
  Map,
  Wrench,
  Activity
} from 'lucide-react';
import clsx from 'clsx';

const AdminSidebar = () => {
  const navigate = useNavigate();
  
  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Incidents', path: '/admin/incidents', icon: AlertTriangle },
    { name: 'Equipment', path: '/admin/equipment', icon: Settings },
    { name: 'Risk Ranking', path: '/admin/risk-ranking', icon: Activity },
    { name: 'Hotspots', path: '/admin/hotspots', icon: Map },
    { name: 'Alerts', path: '/admin/alerts', icon: Bell },
    { name: 'Maintenance', path: '/admin/maintenance', icon: Wrench },
    { name: 'Profile', path: '/admin/profile', icon: User },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
            <span className="text-white text-sm">🏛️</span>
          </div>
          CampusCare
        </h1>
        <p className="text-xs text-slate-400 mt-1">Admin Portal</p>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-4">
        {adminLinks.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
              isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <link.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{link.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <button 
          onClick={() => navigate('/login')}
          className="flex items-center gap-3 px-4 py-3 w-full text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
