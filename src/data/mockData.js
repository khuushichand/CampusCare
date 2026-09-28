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

export const user = {
  name: 'Khuushi',
  role: 'student', // or 'admin'
};
