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
          <Route path="equipment" element={<div className="p-8">Equipment Placeholder</div>} />
          <Route path="risk-ranking" element={<div className="p-8">Risk Ranking Placeholder</div>} />
          <Route path="hotspots" element={<div className="p-8">Hotspots Placeholder</div>} />
          <Route path="alerts" element={<div className="p-8">Alerts Placeholder</div>} />
          <Route path="maintenance" element={<div className="p-8">Maintenance Placeholder</div>} />
          <Route path="profile" element={<div className="p-8">Admin Profile Placeholder</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
