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
      </Routes>
    </Router>
  );
}

export default App;
