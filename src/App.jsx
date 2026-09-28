import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/student/Dashboard';
import ReportIssue from './pages/student/ReportIssue';
import MyReports from './pages/student/MyReports';
import ReportDetails from './pages/student/ReportDetails';
import Notifications from './pages/student/Notifications';
import Profile from './pages/student/Profile';

import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminIncidents from './pages/admin/Incidents';
import AdminIncidentDetails from './pages/admin/IncidentDetails';
import AdminEquipment from './pages/admin/Equipment';
import AdminEquipmentDetails from './pages/admin/EquipmentDetails';
import AdminRiskRanking from './pages/admin/RiskRanking';
import AdminHotspots from './pages/admin/Hotspots';
import AdminAlerts from './pages/admin/Alerts';
import AdminMaintenance from './pages/admin/Maintenance';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="student/dashboard" element={<Dashboard />} />
          <Route path="student/report-issue" element={<ReportIssue />} />
          <Route path="student/my-reports" element={<MyReports />} />
          <Route path="student/reports/:id" element={<ReportDetails />} />
          <Route path="student/notifications" element={<Notifications />} />
          <Route path="student/profile" element={<Profile />} />
          {/* Add more routes here later */}
        </Route>
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="incidents" element={<AdminIncidents />} />
          <Route path="incidents/:id" element={<AdminIncidentDetails />} />
          <Route path="equipment" element={<AdminEquipment />} />
          <Route path="equipment/:id" element={<AdminEquipmentDetails />} />
          <Route path="risk-ranking" element={<AdminRiskRanking />} />
          <Route path="hotspots" element={<AdminHotspots />} />
          <Route path="alerts" element={<AdminAlerts />} />
          <Route path="maintenance" element={<AdminMaintenance />} />
          <Route path="profile" element={<div className="p-8">Admin Profile Placeholder</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
