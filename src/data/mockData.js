const initialReports = [
  {
    id: 'INC-104',
    category: 'Projector',
    equipment: 'Projector P001',
    location: 'Lab 204',
    description: 'Flickering during lecture. Screen goes blank multiple times.',
    status: 'Under Investigation',
    severity: 'High',
    date: 'Sep 28, 2026, 10:12 AM',
    timeline: [
      { status: 'Report submitted', date: 'Sep 28, 10:12 AM' },
      { status: 'Admin acknowledged', date: 'Sep 28, 11:00 AM' },
      { status: 'Under Investigation', date: 'Sep 28, 11:45 AM', active: true }
    ]
  },
  {
    id: 'INC-103',
    category: 'WiFi',
    equipment: 'WiFi',
    location: 'Block A',
    description: 'No connectivity issue in the entire block.',
    status: 'Resolved',
    severity: 'Low',
    date: 'Sep 27, 2026, 09:30 AM',
    timeline: [
      { status: 'Report submitted', date: 'Sep 27, 09:30 AM' },
      { status: 'In Progress', date: 'Sep 27, 10:15 AM' },
      { status: 'Resolved', date: 'Sep 27, 02:00 PM', active: true }
    ]
  },
  {
    id: 'INC-102',
    category: 'AC',
    equipment: 'AC',
    location: 'Lab 101',
    description: 'AC not cooling properly during afternoon sessions.',
    status: 'In Progress',
    severity: 'Medium',
    date: 'Sep 25, 2026, 02:45 PM',
    timeline: [
      { status: 'Report submitted', date: 'Sep 25, 02:45 PM' },
      { status: 'In Progress', date: 'Sep 26, 09:00 AM', active: true }
    ]
  },
];

export const getReports = () => {
  const stored = localStorage.getItem('campuscare_reports');
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem('campuscare_reports', JSON.stringify(initialReports));
  return initialReports;
};

export const addReport = (report) => {
  const current = getReports();
  const updated = [report, ...current];
  localStorage.setItem('campuscare_reports', JSON.stringify(updated));
  return updated;
};

// Kept for backward compatibility if any old files still import it directly
export const reports = initialReports;

export const issueTrends = [
  { name: 'Mon', issues: 12 },
  { name: 'Tue', issues: 19 },
  { name: 'Wed', issues: 15 },
  { name: 'Thu', issues: 22 },
  { name: 'Fri', issues: 18 },
  { name: 'Sat', issues: 8 },
  { name: 'Sun', issues: 5 },
];

export const highRiskEquipment = [
  { id: 'P001', type: 'Projector', location: 'Lab 204', health: 45, risk: 85, status: 'Critical' },
  { id: 'AC011', type: 'Air Conditioner', location: 'Block A', health: 55, risk: 70, status: 'Warning' },
  { id: 'PC024', type: 'Computer', location: 'Computer Lab 2', health: 60, risk: 65, status: 'Warning' },
  { id: 'PR008', type: 'Printer', location: 'Library', health: 30, risk: 90, status: 'Critical' },
];

export const recentAlerts = [
  { id: 1, title: 'Critical equipment risk increased', message: 'Projector P001 risk score exceeded 80 threshold.', severity: 'Critical', time: '10 mins ago' },
  { id: 2, title: 'Multiple reports detected', message: '3 new reports filed for AC in Block A.', severity: 'Warning', time: '1 hour ago' },
  { id: 3, title: 'High complaint activity', message: 'Lab 204 has received 5 complaints today.', severity: 'Warning', time: '2 hours ago' },
];

export const user = {
  name: 'Khuushi',
  role: 'student', // or 'admin'
};
