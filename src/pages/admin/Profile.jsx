import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  Building,
  Power,
  CheckCircle,
  Bell,
  Settings,
  Lock,
} from 'lucide-react';
import clsx from 'clsx';

const PREFERENCES_KEY = 'campuscare_admin_preferences';

const getSavedPreferences = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
    return {
      emailNotifs: typeof saved.emailNotifs === 'boolean' ? saved.emailNotifs : true,
      maintenanceAlerts:
        typeof saved.maintenanceAlerts === 'boolean' ? saved.maintenanceAlerts : true,
    };
  } catch {
    return { emailNotifs: true, maintenanceAlerts: true };
  }
};

const Profile = () => {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(getSavedPreferences);

  const updatePreference = (key) => {
    setPreferences((current) => {
      const updated = { ...current, [key]: !current[key] };

      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Could not save admin preferences:', error);
      }

      return updated;
    });
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const PreferenceToggle = ({ label, description, icon: Icon, enabled, onToggle }) => (
    <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
          <Icon className="w-5 h-5 text-slate-600" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          enabled ? 'bg-blue-600' : 'bg-slate-300'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Profile</h1>
          <p className="text-slate-500 mt-1">
            Manage your administrator account information and preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-600 mx-auto flex items-center justify-center mb-4">
              <User className="w-10 h-10" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              CampusCare Administrator
            </h2>
            <p className="text-sm font-medium text-slate-500 mb-1">
              Maintenance Administrator
            </p>
            <p className="text-sm text-slate-400 mb-4">admin@campuscare.edu</p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
              <CheckCircle className="w-3.5 h-3.5" /> Active
            </span>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  window.alert('Password change functionality is not available in this demo yet.')
                }
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Lock className="w-4 h-4" /> Change Password
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl text-sm font-semibold transition-colors border border-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Power className="w-4 h-4" /> Logout
              </button>
            </div>
          </section>
        </div>

        <div className="md:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" /> Account Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Full Name
                </p>
                <p className="font-semibold text-slate-900">
                  CampusCare Administrator
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> Email
                </p>
                <p className="font-semibold text-slate-900">
                  admin@campuscare.edu
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Role
                </p>
                <p className="font-semibold text-slate-900">
                  Maintenance Administrator
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5">
                  <Building className="w-4 h-4" /> Department
                </p>
                <p className="font-semibold text-slate-900">Campus Facilities</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Account Status
                </p>
                <p className="font-semibold text-green-700">Active</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-600" /> Preferences
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Choose which admin notifications you want to receive. Your choices are saved in this browser.
            </p>

            <div className="space-y-4">
              <PreferenceToggle
                label="Email Notifications"
                description="Receive daily summary reports"
                icon={Mail}
                enabled={preferences.emailNotifs}
                onToggle={() => updatePreference('emailNotifs')}
              />
              <PreferenceToggle
                label="Maintenance Alerts"
                description="Show alerts for critical equipment risk scores"
                icon={Bell}
                enabled={preferences.maintenanceAlerts}
                onToggle={() => updatePreference('maintenanceAlerts')}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;
