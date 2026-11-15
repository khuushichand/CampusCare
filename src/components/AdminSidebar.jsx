import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Settings,
  Bell,
  User,
  LogOut,
  Map,
  Wrench,
  Activity,
  ChevronDown,
  ClipboardList,
  Boxes,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';

const navigationGroups = [
  {
    name: 'Overview',
    icon: LayoutDashboard,
    links: [
      { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    name: 'Issue Management',
    icon: ClipboardList,
    links: [
      { name: 'Incidents', path: '/admin/incidents', icon: AlertTriangle },
      { name: 'Alerts', path: '/admin/alerts', icon: Bell },
      { name: 'Maintenance', path: '/admin/maintenance', icon: Wrench },
    ],
  },
  {
    name: 'Assets & Insights',
    icon: Boxes,
    links: [
      { name: 'Equipment', path: '/admin/equipment', icon: Settings },
      { name: 'Risk Ranking', path: '/admin/risk-ranking', icon: Activity },
      { name: 'Hotspots', path: '/admin/hotspots', icon: Map },
    ],
  },
  {
    name: 'Account',
    icon: User,
    links: [
      { name: 'Profile', path: '/admin/profile', icon: User },
    ],
  },
];

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Keep the group containing the current page open automatically.
  const [openGroups, setOpenGroups] = useState(() => {
    const activeGroup = navigationGroups.find((group) =>
      group.links.some((link) => link.path === location.pathname)
    );
    return activeGroup ? [activeGroup.name] : ['Overview', 'Issue Management', 'Assets & Insights', 'Account'];
  });

  const toggleGroup = (groupName) => {
    setOpenGroups((current) =>
      current.includes(groupName)
        ? current.filter((name) => name !== groupName)
        : [...current, groupName]
    );
  };

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
            <span className="text-white text-sm">🏛️</span>
          </div>
          CampusCare
        </h1>
        <p className="text-xs text-slate-400 mt-1">Admin Portal</p>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 px-3 mt-3 space-y-2">
        {navigationGroups.map((group) => {
          const isOpen = openGroups.includes(group.name);
          const hasActiveLink = group.links.some((link) => link.path === location.pathname);

          return (
            <section key={group.name}>
              <button
                type="button"
                onClick={() => toggleGroup(group.name)}
                aria-expanded={isOpen}
                className={clsx(
                  'w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors',
                  hasActiveLink
                    ? 'text-white bg-slate-800'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <span className="flex items-center gap-3">
                  <group.icon className="w-5 h-5" />
                  <span className="font-semibold text-sm">{group.name}</span>
                </span>
                <ChevronDown
                  className={clsx(
                    'w-4 h-4 transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <div className="mt-1 ml-4 pl-3 border-l border-slate-700 space-y-1">
                  {group.links.map((link) => (
                    <NavLink
                      key={link.path}
                      to={link.path}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        )
                      }
                    >
                      <link.icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{link.name}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800">
        <button
          type="button"
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
