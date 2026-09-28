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

export const adminIncidents = [
  {
    id: 'INC-245',
    issue: 'Projector not working',
    issueType: 'Projector',
    description: 'Projector in Lab 204 is not displaying the lecture content.',
    location: 'Lab 204',
    equipment: 'Projector P001',
    reportedBy: 'Student',
    severity: 'High',
    status: 'Open',
    date: 'Sep 28, 2026, 09:15 AM',
    healthScore: 42,
    riskScore: 78,
    equipmentStatus: 'High Risk',
    timeline: [
      { status: 'Report submitted', date: 'Sep 28, 09:15 AM' },
      { status: 'Incident reviewed by maintenance team', date: 'Sep 28, 09:45 AM' },
      { status: 'Technician assigned', date: 'Sep 28, 10:30 AM', active: true }
    ],
    relatedIncidents: [
      { id: 'INC-210', issue: 'Flickering display', date: 'Sep 21, 2026', status: 'Resolved' },
      { id: 'INC-198', issue: 'Overheating warning', date: 'Sep 15, 2026', status: 'Resolved' }
    ]
  },
  {
    id: 'INC-244',
    issue: 'WiFi connectivity issue',
    issueType: 'Network',
    description: 'No internet access in Block A. Affecting multiple classes.',
    location: 'Block A',
    equipment: 'Router A-12',
    reportedBy: 'Student',
    severity: 'Medium',
    status: 'In Progress',
    date: 'Sep 27, 2026, 11:30 AM',
    healthScore: 65,
    riskScore: 40,
    equipmentStatus: 'Moderate',
    timeline: [
      { status: 'Report submitted', date: 'Sep 27, 11:30 AM' },
      { status: 'Status changed to In Progress', date: 'Sep 27, 12:00 PM', active: true }
    ],
    relatedIncidents: []
  },
  {
    id: 'INC-243',
    issue: 'Air conditioner not cooling',
    issueType: 'HVAC',
    description: 'AC blowing warm air, making the room unusable.',
    location: 'Block B',
    equipment: 'AC042',
    reportedBy: 'Student',
    severity: 'Critical',
    status: 'Open',
    date: 'Sep 27, 2026, 08:00 AM',
    healthScore: 25,
    riskScore: 92,
    equipmentStatus: 'Critical',
    timeline: [
      { status: 'Report submitted', date: 'Sep 27, 08:00 AM', active: true }
    ],
    relatedIncidents: [
      { id: 'INC-205', issue: 'Loud noise from vent', date: 'Sep 18, 2026', status: 'Resolved' }
    ]
  },
  {
    id: 'INC-242',
    issue: 'Printer not responding',
    issueType: 'Printer',
    description: 'Library printer is offline and not accepting print jobs.',
    location: 'Library',
    equipment: 'Printer LIB-01',
    reportedBy: 'Student',
    severity: 'Low',
    status: 'Resolved',
    date: 'Sep 26, 2026, 03:20 PM',
    healthScore: 85,
    riskScore: 15,
    equipmentStatus: 'Good',
    timeline: [
      { status: 'Report submitted', date: 'Sep 26, 03:20 PM' },
      { status: 'Status changed to In Progress', date: 'Sep 26, 04:00 PM' },
      { status: 'Technician resolved the issue', date: 'Sep 26, 05:30 PM', active: true }
    ],
    relatedIncidents: []
  }
];

export const adminEquipment = [
  {
    id: 'P001',
    name: 'Projector',
    type: 'Projector',
    location: 'Lab 204',
    healthScore: 42,
    riskScore: 78,
    status: 'High Risk',
    lastMaintenance: '2026-08-15',
    installationDate: '2023-06-15',
    age: '3 years',
    failureCount: 7,
    downtime: '18 hours',
    riskFactors: [
      { factor: 'Frequent recent complaints', severity: 'High' },
      { factor: 'Multiple previous failures', severity: 'Medium' },
      { factor: 'High downtime', severity: 'Medium' },
      { factor: 'Aging equipment', severity: 'Low' }
    ],
    maintenanceHistory: [
      { date: '2026-08-15', type: 'Routine Inspection', team: 'Maintenance Team', result: 'Completed' },
      { date: '2026-06-21', type: 'Lamp Replacement', team: 'Maintenance Team', result: 'Completed' },
      { date: '2026-03-12', type: 'Repair', team: 'Electrical Team', result: 'Completed' }
    ],
    relatedIncidents: [
      { id: 'INC-245', issue: 'Projector not working', severity: 'High', status: 'Open' },
      { id: 'INC-231', issue: 'Display flickering', severity: 'Medium', status: 'Resolved' },
      { id: 'INC-218', issue: 'Projector overheating', severity: 'High', status: 'Resolved' }
    ]
  },
  {
    id: 'P002',
    name: 'Projector',
    type: 'Projector',
    location: 'Lab 205',
    healthScore: 86,
    riskScore: 24,
    status: 'Healthy',
    lastMaintenance: '2026-09-05',
    installationDate: '2024-01-10',
    age: '2.5 years',
    failureCount: 1,
    downtime: '2 hours',
    riskFactors: [
      { factor: 'Recent installation', severity: 'Low' }
    ],
    maintenanceHistory: [
      { date: '2026-09-05', type: 'Routine Inspection', team: 'Maintenance Team', result: 'Completed' }
    ],
    relatedIncidents: []
  },
  {
    id: 'PC024',
    name: 'Computer',
    type: 'Computer',
    location: 'Computer Lab 2',
    healthScore: 61,
    riskScore: 55,
    status: 'Warning',
    lastMaintenance: '2026-08-28',
    installationDate: '2022-08-20',
    age: '4 years',
    failureCount: 4,
    downtime: '12 hours',
    riskFactors: [
      { factor: 'Aging equipment', severity: 'High' },
      { factor: 'Multiple previous failures', severity: 'Medium' }
    ],
    maintenanceHistory: [
      { date: '2026-08-28', type: 'Software Update', team: 'IT Team', result: 'Completed' },
      { date: '2026-05-10', type: 'Hardware Repair', team: 'IT Team', result: 'Completed' }
    ],
    relatedIncidents: [
      { id: 'INC-212', issue: 'Blue screen error', severity: 'Medium', status: 'Resolved' }
    ]
  },
  {
    id: 'AC011',
    name: 'Air Conditioner',
    type: 'Air Conditioner',
    location: 'Block A',
    healthScore: 35,
    riskScore: 82,
    status: 'Critical',
    lastMaintenance: '2026-08-10',
    installationDate: '2021-04-05',
    age: '5 years',
    failureCount: 9,
    downtime: '36 hours',
    riskFactors: [
      { factor: 'High downtime', severity: 'High' },
      { factor: 'Frequent recent complaints', severity: 'High' },
      { factor: 'Aging equipment', severity: 'High' }
    ],
    maintenanceHistory: [
      { date: '2026-08-10', type: 'Coolant Refill', team: 'Maintenance Team', result: 'Completed' },
      { date: '2026-07-02', type: 'Filter Cleaning', team: 'Maintenance Team', result: 'Completed' },
      { date: '2026-04-15', type: 'Compressor Repair', team: 'Electrical Team', result: 'Completed' }
    ],
    relatedIncidents: [
      { id: 'INC-243', issue: 'Air conditioner not cooling', severity: 'Critical', status: 'Open' },
      { id: 'INC-220', issue: 'Water leaking from AC', severity: 'High', status: 'Resolved' }
    ]
  },
  {
    id: 'PR008',
    name: 'Printer',
    type: 'Printer',
    location: 'Library',
    healthScore: 91,
    riskScore: 15,
    status: 'Healthy',
    lastMaintenance: '2026-09-12',
    installationDate: '2025-02-14',
    age: '1.5 years',
    failureCount: 2,
    downtime: '4 hours',
    riskFactors: [
      { factor: 'Low consumable levels', severity: 'Low' }
    ],
    maintenanceHistory: [
      { date: '2026-09-12', type: 'Toner Replacement', team: 'IT Support', result: 'Completed' },
      { date: '2026-05-20', type: 'Paper Jam Fix', team: 'IT Support', result: 'Completed' }
    ],
    relatedIncidents: [
      { id: 'INC-242', issue: 'Printer not responding', severity: 'Low', status: 'Resolved' }
    ]
  }
];

export const user = {
  name: 'Khuushi',
  role: 'student', // or 'admin'
};
