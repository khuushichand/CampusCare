import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Calendar,
  Wrench,
  Settings,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Plus,
  X,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import clsx from 'clsx';

import {
  getEquipmentById,
  getMaintenance,
  getIncidents,
  calculateRisk,
  createMaintenance,
} from '../../services/api';


// ==================================================
// HELPERS
// ==================================================

const normalizeList = (data, key) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.[key])) {
    return data[key];
  }

  return [];
};


const getDisplayStatus = (equipment) => {
  const backendStatus = String(equipment?.status || '').toUpperCase();

  const healthScore = Number(equipment?.health_score ?? 0);
  const riskScore = Number(equipment?.risk_score ?? 0);

  // Use the actual backend status where possible.
  if (backendStatus === 'CRITICAL') {
    return 'Critical';
  }

  if (backendStatus === 'HIGH RISK') {
    return 'High Risk';
  }

  if (
    backendStatus === 'NEEDS MAINTENANCE' ||
    backendStatus === 'WARNING'
  ) {
    return 'Warning';
  }

  if (backendStatus === 'OPERATIONAL') {
    // Operational equipment with elevated risk should
    // still be visually shown as Warning.
    if (riskScore >= 70 || healthScore < 40) {
      return 'Critical';
    }

    if (riskScore >= 40 || healthScore < 70) {
      return 'Warning';
    }

    return 'Healthy';
  }

  // Fallback based on actual backend scores.
  if (riskScore >= 70 || healthScore < 40) {
    return 'Critical';
  }

  if (riskScore >= 40 || healthScore < 70) {
    return 'Warning';
  }

  return 'Healthy';
};


const getSeverityLabel = (severity) => {
  const value = String(severity || '').toUpperCase();

  switch (value) {
    case 'CRITICAL':
      return 'Critical';

    case 'HIGH':
      return 'High';

    case 'MEDIUM':
      return 'Medium';

    case 'LOW':
      return 'Low';

    default:
      return 'Unknown';
  }
};


const getIncidentStatusLabel = (status) => {
  const value = String(status || '').toUpperCase();

  switch (value) {
    case 'OPEN':
      return 'Open';

    case 'IN_PROGRESS':
      return 'In Progress';

    case 'RESOLVED':
      return 'Resolved';

    case 'CLOSED':
      return 'Closed';

    default:
      return status || 'Unknown';
  }
};


// ==================================================
// STATUS BADGE
// ==================================================

const StatusBadge = ({ status }) => {
  const styles = {
    Healthy:
      'bg-green-100 text-green-700 border-green-200',

    Warning:
      'bg-orange-100 text-orange-700 border-orange-200',

    'High Risk':
      'bg-red-50 text-red-600 border-red-200',

    Critical:
      'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-full text-xs font-semibold border',
        styles[status] ||
        'bg-slate-100 text-slate-700 border-slate-200'
      )}
    >
      {status || 'Unknown'}
    </span>
  );
};


// ==================================================
// SEVERITY BADGE
// ==================================================

const SeverityBadge = ({ severity }) => {
  const label = getSeverityLabel(severity);

  const styles = {
    Critical:
      'bg-red-100 text-red-700',

    High:
      'bg-red-100 text-red-700',

    Medium:
      'bg-orange-100 text-orange-700',

    Low:
      'bg-green-100 text-green-700',

    Unknown:
      'bg-slate-100 text-slate-600',
  };

  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
        styles[label] || styles.Unknown
      )}
    >
      {label}
    </span>
  );
};


// ==================================================
// INCIDENT STATUS BADGE
// ==================================================

const IncidentStatusBadge = ({ status }) => {
  const label = getIncidentStatusLabel(status);

  const styles = {
    Open:
      'text-purple-700 bg-purple-50',

    'In Progress':
      'text-blue-700 bg-blue-50',

    Resolved:
      'text-green-700 bg-green-50',

    Closed:
      'text-slate-600 bg-slate-100',

    Unknown:
      'text-slate-600 bg-slate-100',
  };

  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
        styles[label] || styles.Unknown
      )}
    >
      {label}
    </span>
  );
};


// ==================================================
// EQUIPMENT DETAILS
// ==================================================

const EquipmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [equipment, setEquipment] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState('');

  // Risk recalculation
  const [riskCalculating, setRiskCalculating] = useState(false);
  const [riskMessage, setRiskMessage] = useState('');

  // Schedule maintenance modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    description: '',
    technician: 'Campus IT Support',
    scheduled_date: new Date().toISOString().split('T')[0],
  });
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState('');

  // --------------------------------------------------
  // LOAD EVERYTHING FROM BACKEND
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadEquipmentDetails = async () => {
      try {
        setLoading(true);
        setError('');

        const [
          equipmentResponse,
          maintenanceResponse,
          incidentsResponse,
        ] = await Promise.all([
          getEquipmentById(id),
          getMaintenance(),
          getIncidents(),
        ]);

        if (cancelled) {
          return;
        }

        // --------------------------------------------------
        // EQUIPMENT
        // --------------------------------------------------

        const equipmentData =
          equipmentResponse?.equipment ||
          equipmentResponse;

        setEquipment(equipmentData);

        // --------------------------------------------------
        // MAINTENANCE
        // --------------------------------------------------

        const maintenanceList = normalizeList(
          maintenanceResponse,
          'maintenance'
        );

        const equipmentMaintenance =
          maintenanceList.filter(
            (item) =>
              String(item?.equipment_id || '') === String(id)
          );

        setMaintenance(equipmentMaintenance);

        // --------------------------------------------------
        // INCIDENTS
        // --------------------------------------------------

        const incidentList = normalizeList(
          incidentsResponse,
          'incidents'
        );

        const equipmentIncidents =
          incidentList.filter(
            (item) =>
              String(item?.equipment_id || '') === String(id)
          );

        setIncidents(equipmentIncidents);
        setLastRefreshed(new Date());

      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          'Failed to load equipment details:',
          err
        );

        setError(
          err?.message ||
          'Failed to load equipment details'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadEquipmentDetails();

    return () => {
      cancelled = true;
    };
  }, [id]);


  // --------------------------------------------------
  // REFRESH DETAILS WITHOUT HIDING THE CURRENT PAGE
  // --------------------------------------------------

  const handleRefresh = async () => {
    if (refreshing) return;

    try {
      setRefreshing(true);
      setRefreshError('');

      const [equipmentResponse, maintenanceResponse, incidentsResponse] =
        await Promise.all([
          getEquipmentById(id),
          getMaintenance(),
          getIncidents(),
        ]);

      const equipmentData = equipmentResponse?.equipment || equipmentResponse;
      if (!equipmentData || typeof equipmentData !== 'object') {
        throw new Error('Equipment details were not returned by the server.');
      }

      const maintenanceList = normalizeList(maintenanceResponse, 'maintenance');
      const incidentList = normalizeList(incidentsResponse, 'incidents');

      setEquipment(equipmentData);
      setMaintenance(
        maintenanceList.filter(
          (item) => String(item?.equipment_id || '') === String(id)
        )
      );
      setIncidents(
        incidentList.filter(
          (item) => String(item?.equipment_id || '') === String(id)
        )
      );
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to refresh equipment details:', err);
      setRefreshError(
        err?.message || 'Could not refresh equipment details. Showing the last loaded data.'
      );
    } finally {
      setRefreshing(false);
    }
  };


  // --------------------------------------------------
  // RECALCULATE RISK
  // --------------------------------------------------

  const handleRecalculateRisk = async () => {
    if (!equipment?.id) return;

    try {
      setRiskCalculating(true);
      setRiskMessage('');

      const result = await calculateRisk(equipment.id);

      // Refresh equipment to get updated risk_score
      const updated = await getEquipmentById(equipment.id);
      const updatedEquipment = updated?.equipment || updated;

      setEquipment(updatedEquipment);
      setLastRefreshed(new Date());
      setRiskMessage(
        `Risk recalculated: ${result?.risk_score ?? updatedEquipment?.risk_score ?? 'updated'}`
      );
    } catch (err) {
      setRiskMessage(
        `Recalculation failed: ${err.message || 'Unknown error'}`
      );
    } finally {
      setRiskCalculating(false);
    }
  };


  // --------------------------------------------------
  // SCHEDULE MAINTENANCE
  // --------------------------------------------------

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    const equipId = equipment?.id || id;
    if (!scheduleForm.title.trim() || !scheduleForm.scheduled_date) {
      setScheduleError('Title and scheduled date are required.');
      return;
    }

    setScheduleSubmitting(true);
    setScheduleError('');
    try {
      await createMaintenance({
        equipment_id: equipId,
        title: scheduleForm.title.trim(),
        description:
          scheduleForm.description.trim() || 'Scheduled maintenance service inspection',
        technician: scheduleForm.technician.trim() || 'Campus IT Support',
        scheduled_date: scheduleForm.scheduled_date,
      });

      // Refresh maintenance records
      const maintenanceResponse = await getMaintenance();
      const maintenanceList = normalizeList(maintenanceResponse, 'maintenance');
      setMaintenance(
        maintenanceList.filter(
          (item) => String(item?.equipment_id || '') === String(equipId)
        )
      );

      setScheduleSuccess(`Maintenance "${scheduleForm.title.trim()}" scheduled successfully!`);
      setShowScheduleModal(false);
      setScheduleForm({
        title: '',
        description: '',
        technician: 'Campus IT Support',
        scheduled_date: new Date().toISOString().split('T')[0],
      });
      setTimeout(() => setScheduleSuccess(''), 5000);
    } catch (err) {
      setScheduleError(err.message || 'Failed to schedule maintenance.');
    } finally {
      setScheduleSubmitting(false);
    }
  };


  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <p className="text-slate-500">
          Loading equipment details...
        </p>
      </div>
    );
  }


  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
          <h2 className="font-bold text-lg mb-2">
            Failed to load equipment
          </h2>

          <p className="text-sm">
            {error}
          </p>

          <button
            onClick={() =>
              navigate('/admin/equipment')
            }
            className="mt-4 text-sm font-semibold text-blue-600"
          >
            ← Back to Equipment
          </button>
        </div>
      </div>
    );
  }


  // --------------------------------------------------
  // NOT FOUND
  // --------------------------------------------------

  if (!equipment) {
    return (
      <div className="max-w-4xl mx-auto text-center mt-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Equipment not found
        </h2>

        <button
          onClick={() =>
            navigate('/admin/equipment')
          }
          className="text-blue-600 font-medium"
        >
          Back to Equipment
        </button>
      </div>
    );
  }


  // ==================================================
  // REAL BACKEND VALUES & DERIVED METRICS
  // ==================================================

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const healthScore = toNumber(equipment.health_score);
  const riskScore = toNumber(equipment.risk_score);
  const failureCount = toNumber(equipment.failure_count);

  const displayStatus = getDisplayStatus(equipment);

  // Days since last maintenance calculation
  const getDaysSince = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
      return diff >= 0 ? diff : 0;
    } catch {
      return null;
    }
  };
  const daysSinceMaintenance = getDaysSince(equipment.last_maintenance);
  const isMaintenanceOverdue = daysSinceMaintenance !== null && daysSinceMaintenance > 90;

  // Estimated Operational Availability / Uptime percentage
  const estimatedAvailability = Math.max(
    72.0,
    Math.min(99.9, 100 - (failureCount * 1.5) - ((100 - healthScore) * 0.12))
  ).toFixed(1);

  // Deterministic Formula Components (matches risk_service.py)
  const failureComponent = Math.min(failureCount * 10, 50);
  const healthComponent = Math.min(Math.max((100 - healthScore) * 0.5, 0), 50);
  const openIncidents = incidents.filter((i) => {
    const s = String(i.status || '').toUpperCase();
    return s === 'OPEN' || s === 'IN_PROGRESS';
  });

  // ==================================================
  // RISK FACTORS LIST
  // ==================================================

  const riskFactors = [];

  if (riskScore >= 70) {
    riskFactors.push({
      factor: 'Current Risk Level',
      severity: 'Critical',
    });
  } else if (riskScore >= 40) {
    riskFactors.push({
      factor: 'Current Risk Level',
      severity: 'High',
    });
  } else if (riskScore >= 20) {
    riskFactors.push({
      factor: 'Current Risk Level',
      severity: 'Medium',
    });
  } else {
    riskFactors.push({
      factor: 'Current Risk Level',
      severity: 'Low',
    });
  }

  if (failureCount >= 5) {
    riskFactors.push({
      factor: 'Historical Failure Impact',
      severity: 'High',
    });
  } else if (failureCount >= 3) {
    riskFactors.push({
      factor: 'Historical Failure Impact',
      severity: 'Medium',
    });
  } else {
    riskFactors.push({
      factor: 'Historical Failure Impact',
      severity: 'Low',
    });
  }

  if (healthScore < 40) {
    riskFactors.push({
      factor: 'Hardware Degradation',
      severity: 'Critical',
    });
  } else if (healthScore < 70) {
    riskFactors.push({
      factor: 'Hardware Degradation',
      severity: 'Medium',
    });
  } else {
    riskFactors.push({
      factor: 'Hardware Degradation',
      severity: 'Low',
    });
  }

  if (isMaintenanceOverdue) {
    riskFactors.push({
      factor: 'Service Interval Exceeded',
      severity: 'High',
    });
  }

  if (openIncidents.length > 0) {
    riskFactors.push({
      factor: 'Active Reported Issues',
      severity: openIncidents.length >= 2 ? 'High' : 'Medium',
    });
  }

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ==================================================
          HEADER & BREADCRUMB
      ================================================== */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">

        <div className="flex items-center gap-4">

          <button
            onClick={() => navigate('/admin/equipment')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 shadow-sm font-medium text-sm"
            title="Back to Equipment list"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Equipment</span>
          </button>

          <div>

            <div className="flex items-center gap-3">

              <h1 className="text-2xl font-bold text-slate-900">
                {equipment.name || 'Unnamed equipment'}
              </h1>

              <StatusBadge
                status={displayStatus}
              />

            </div>

            <p className="text-slate-500 mt-1 font-medium text-sm flex items-center gap-2">
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-700">
                {equipment.id || id}
              </span>
              <span>•</span>
              <span>{equipment.location || 'Campus Location'}</span>
              <span>•</span>
              <span>{equipment.type || 'Equipment'}</span>
            </p>

          </div>

        </div>

        {/* PAGE ACTIONS */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Refresh latest data"
            >
              <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => {
                setScheduleForm({
                  title: `${equipment.name || 'Equipment'} Maintenance`,
                  description: `Routine inspection and service for ${equipment.name || 'equipment'} (${equipment.id || id}) in ${equipment.location || 'campus'}.`,
                  technician: 'Campus IT Support',
                  scheduled_date: new Date().toISOString().split('T')[0],
                });
                setScheduleError('');
                setShowScheduleModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm"
              title="Schedule maintenance for this equipment"
            >
              <Wrench className="w-4 h-4" />
              <span>Schedule Maintenance</span>
            </button>

            <button
              onClick={handleRecalculateRisk}
              disabled={riskCalculating}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Recalculate deterministic risk score"
            >
              <Activity className={clsx('w-4 h-4', riskCalculating && 'animate-pulse')} />
              <span>{riskCalculating ? 'Calculating…' : 'Recalculate Risk'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {riskMessage && (
              <span className="text-xs text-blue-600 font-medium">
                {riskMessage}
              </span>
            )}
            {lastRefreshed && (
              <span className="text-xs text-slate-400">
                Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

      </div>

      {scheduleSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>{scheduleSuccess}</span>
          </div>
          <button
            onClick={() => setScheduleSuccess('')}
            className="text-green-700 hover:text-green-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {refreshError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
          <span>{refreshError}</span>
          <button
            onClick={() => setRefreshError('')}
            className="text-amber-800 hover:text-amber-950 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* ==================================================
          MAIN GRID
      ================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


        {/* ==================================================
            LEFT / MAIN SECTION
        ================================================== */}

        <div className="lg:col-span-2 space-y-6">


          {/* ==================================================
              EQUIPMENT INFORMATION
          ================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">

              <Settings className="w-5 h-5 text-blue-600" />

              Equipment Information

            </h3>


            <div className="grid grid-cols-2 gap-y-6 text-sm">


              {/* EQUIPMENT ID */}

              <div>

                <p className="text-slate-500 font-medium mb-1">
                  Equipment ID
                </p>

                <p className="font-semibold text-slate-900">
                  {equipment.id || id}
                </p>

              </div>


              {/* EQUIPMENT NAME */}

              <div>

                <p className="text-slate-500 font-medium mb-1">
                  Equipment Name
                </p>

                <p className="font-semibold text-slate-900">
                  {equipment.name || 'Unnamed equipment'}
                </p>

              </div>


              {/* TYPE */}

              <div>

                <p className="text-slate-500 font-medium mb-1">
                  Type
                </p>

                <p className="font-semibold text-slate-900">
                  {equipment.type || 'N/A'}
                </p>

              </div>


              {/* LOCATION */}

              <div>

                <p className="text-slate-500 font-medium mb-1">
                  Location
                </p>

                <p className="font-semibold text-slate-900">
                  {equipment.location || 'N/A'}
                </p>

              </div>


              {/* INSTALLATION DATE */}

              <div>

                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5">

                  <Calendar className="w-4 h-4" />

                  Installation Date

                </p>

                <p className="font-semibold text-slate-900">
                  {equipment.installation_date ||
                    equipment.installationDate ||
                    'N/A'}
                </p>

              </div>


              {/* AGE */}

              <div>

                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5">

                  <Activity className="w-4 h-4" />

                  Age

                </p>

                <p className="font-semibold text-slate-900">
                  {equipment.age || 'N/A'}
                </p>

              </div>


              {/* LAST MAINTENANCE */}

              <div>

                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5">

                  <Wrench className="w-4 h-4" />

                  Last Maintenance

                </p>

                <p className="font-semibold text-slate-900">
                  {equipment.last_maintenance ||
                    'N/A'}
                </p>

              </div>


              {/* TOTAL FAILURES */}

              <div>

                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1.5">

                  <AlertTriangle className="w-4 h-4" />

                  Total Failures

                </p>

                <p className="font-semibold text-slate-900">
                  {failureCount}
                </p>

              </div>

            </div>


            {/* CURRENT STATUS */}

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-4">

              <span className="text-sm font-medium text-slate-500">
                Current Status:
              </span>

              <StatusBadge
                status={displayStatus}
              />

            </div>

          </div>


          {/* ==================================================
              MAINTENANCE HISTORY
          ================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">

              <Wrench className="w-5 h-5 text-purple-600" />

              Maintenance History

            </h3>


            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm text-slate-600">

                <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-y border-slate-100">

                  <tr>

                    <th className="px-4 py-3 font-medium">
                      Date
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Maintenance Type
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Technician/Team
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Result
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {maintenance.map((maint, index) => {

                    const date =
                      maint.scheduled_date ||
                      maint.date ||
                      maint.maintenance_date ||
                      'N/A';

                    const type =
                      maint.title ||
                      maint.type ||
                      maint.maintenance_type ||
                      'Maintenance';

                    const technician =
                      maint.technician ||
                      maint.team ||
                      maint.technician_team ||
                      'N/A';

                    const result =
                      maint.status ||
                      maint.result ||
                      'Unknown';

                    return (
                      <tr
                        key={
                          maint.maintenance_id ||
                          maint.id ||
                          index
                        }
                        className="hover:bg-slate-50/50 transition-colors"
                      >

                        <td className="px-4 py-3 font-medium text-slate-900">
                          {date}
                        </td>

                        <td className="px-4 py-3">
                          {type}
                        </td>

                        <td className="px-4 py-3">
                          {technician}
                        </td>

                        <td className="px-4 py-3">

                          <span
                            className={clsx(
                              'font-medium text-xs px-2 py-0.5 rounded-full',
                              String(result).toUpperCase() ===
                                'COMPLETED'
                                ? 'text-green-600 bg-green-50'
                                : String(result).toUpperCase() ===
                                  'IN_PROGRESS'
                                  ? 'text-blue-600 bg-blue-50'
                                  : String(result).toUpperCase() ===
                                    'CANCELLED'
                                    ? 'text-red-600 bg-red-50'
                                    : 'text-orange-600 bg-orange-50'
                            )}
                          >
                            {result}
                          </span>

                        </td>

                      </tr>
                    );
                  })}


                  {maintenance.length === 0 && (

                    <tr>

                      <td
                        colSpan="4"
                        className="px-4 py-6 text-center text-slate-500"
                      >
                        No maintenance records found for this equipment.
                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>


        {/* ==================================================
            RIGHT / SIDE SECTION
        ================================================== */}

        <div className="space-y-6">


          {/* ==================================================
              EQUIPMENT HEALTH
          ================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">

              <Activity className="w-5 h-5 text-orange-500" />

              Equipment Health

            </h3>


            <div className="space-y-6">


              {/* HEALTH SCORE */}

              <div>

                <div className="flex justify-between text-sm mb-1.5">

                  <span className="font-semibold text-slate-700">
                    Health Score
                  </span>

                  <span
                    className={clsx(
                      'font-bold',
                      healthScore >= 70
                        ? 'text-green-600'
                        : healthScore >= 40
                          ? 'text-orange-500'
                          : 'text-red-600'
                    )}
                  >
                    {healthScore}%
                  </span>

                </div>


                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">

                  <div
                    className={clsx(
                      'h-full rounded-full',
                      healthScore >= 70
                        ? 'bg-green-500'
                        : healthScore >= 40
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, healthScore)
                      )}%`,
                    }}
                  />

                </div>

              </div>


              {/* RISK SCORE */}

              <div>

                <div className="flex justify-between text-sm mb-1.5">

                  <span className="font-semibold text-slate-700">
                    Risk Score
                  </span>

                  <span
                    className={clsx(
                      'font-bold',
                      riskScore >= 70
                        ? 'text-red-600'
                        : riskScore >= 40
                          ? 'text-orange-500'
                          : 'text-green-600'
                    )}
                  >
                    {riskScore}
                  </span>

                </div>


                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">

                  <div
                    className={clsx(
                      'h-full rounded-full',
                      riskScore >= 70
                        ? 'bg-red-500'
                        : riskScore >= 40
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, riskScore)
                      )}%`,
                    }}
                  />

                </div>

              </div>

            </div>


            {/* HEALTH & OPERATIONAL SUMMARY */}

            <div className="mt-8 grid grid-cols-2 gap-4">

              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Historical Failures
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {failureCount}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Weight: {failureComponent.toFixed(0)}/50 pts
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Active Incidents
                </p>
                <p className={clsx(
                  "text-xl font-bold",
                  openIncidents.length > 0 ? "text-amber-600" : "text-green-600"
                )}>
                  {openIncidents.length}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {incidents.length} total logged
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Est. Availability
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {estimatedAvailability}%
                </p>
                <p className="text-[11px] text-green-600 font-medium mt-0.5">
                  Uptime rating
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Service Recency
                </p>
                <p className="text-base font-bold text-slate-900 mt-1">
                  {daysSinceMaintenance !== null ? `${daysSinceMaintenance}d ago` : 'None'}
                </p>
                <p className={clsx(
                  "text-[11px] font-medium mt-0.5",
                  isMaintenanceOverdue ? "text-red-500 font-semibold" : "text-slate-400"
                )}>
                  {isMaintenanceOverdue ? "Overdue (>90d)" : "Within window"}
                </p>
              </div>

            </div>

          </div>


          {/* ==================================================
              PREDICTED RISK BREAKDOWN & FACTORS
          ================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Risk Factors &amp; Formula
                </h3>
                <p className="text-xs text-slate-500">
                  Deterministic prediction: Failures (max 50) + Health Degradation (max 50)
                </p>
              </div>
              <StatusBadge status={displayStatus} />
            </div>

            {/* Formula Breakdown Progress Bars */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1 text-slate-700">
                  <span>Failure Component (10 pts/failure, max 50)</span>
                  <span className="font-bold text-slate-900">{failureComponent.toFixed(1)} / 50.0 pts</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-500",
                      failureComponent >= 40 ? "bg-red-500" : failureComponent >= 20 ? "bg-orange-500" : "bg-blue-500"
                    )}
                    style={{ width: `${(failureComponent / 50) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1 text-slate-700">
                  <span>Health Degradation Component ((100 - Health) × 0.5)</span>
                  <span className="font-bold text-slate-900">{healthComponent.toFixed(1)} / 50.0 pts</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-500",
                      healthComponent >= 30 ? "bg-red-500" : healthComponent >= 15 ? "bg-orange-500" : "bg-green-500"
                    )}
                    style={{ width: `${(healthComponent / 50) * 100}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Total Calculated Score:</span>
                <span className="font-bold font-mono text-sm text-blue-600">
                  {riskScore} / 100.0
                </span>
              </div>
            </div>

            {/* Qualitative Alerts List */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Risk Categorization Factors
              </p>
              {riskFactors.map((factor, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50/70 border border-slate-100"
                >
                  <span className="text-xs font-medium text-slate-700">
                    {factor.factor}
                  </span>
                  <SeverityBadge severity={factor.severity} />
                </div>
              ))}
            </div>

          </div>


          {/* ==================================================
              RELATED INCIDENTS
          ================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <h3 className="text-lg font-bold text-slate-900 mb-5">
              Related Incidents
            </h3>


            <div className="space-y-3">

              {incidents.map((incident, index) => {

                const incidentId =
                  incident.incident_id ||
                  incident.id;

                const title =
                  incident.title ||
                  incident.issue ||
                  incident.description ||
                  'Equipment issue';

                const severity =
                  incident.severity ||
                  incident.priority ||
                  'MEDIUM';

                return (
                  <div
                    key={incidentId || index}
                    onClick={() => {
                      if (incidentId) {
                        navigate(
                          `/admin/incidents/${incidentId}`
                        );
                      }
                    }}
                    className="block p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >

                    <div className="flex justify-between items-start mb-1">

                      <span className="font-bold text-sm text-slate-900">
                        {incidentId || 'Incident'}
                      </span>

                      <IncidentStatusBadge
                        status={incident.status}
                      />

                    </div>


                    <p className="text-sm text-slate-600 truncate">
                      {title}
                    </p>


                    <div className="mt-2">

                      <SeverityBadge
                        severity={severity}
                      />

                    </div>

                  </div>
                );
              })}


              {incidents.length === 0 && (

                <p className="text-sm text-slate-500 text-center py-2">
                  No related incidents found.
                </p>

              )}

            </div>

          </div>

        </div>

      </div>

      {/* ==================================================
          SCHEDULE MAINTENANCE MODAL
      ================================================== */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Schedule Maintenance
                  </h3>
                  <p className="text-xs text-slate-500">
                    Equipment: {equipment?.name} ({equipment?.id || id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {scheduleError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {scheduleError}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service / Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Compressor filter replacement"
                  value={scheduleForm.title}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Work Details
                </label>
                <textarea
                  rows="3"
                  placeholder="Detail the issue, symptoms, or standard maintenance procedure..."
                  value={scheduleForm.description}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Technician / Assigned Team *
                  </label>
                  <select
                    value={scheduleForm.technician}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, technician: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="Campus IT Support">Campus IT Support</option>
                    <option value="HVAC Engineering Team">HVAC Engineering Team</option>
                    <option value="Electrical Team">Electrical Team</option>
                    <option value="Audiovisual Tech Team">Audiovisual Tech Team</option>
                    <option value="Facilities & Hardware">Facilities &amp; Hardware</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.scheduled_date}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, scheduled_date: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  disabled={scheduleSubmitting}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-60 transition-colors shadow-sm"
                >
                  {scheduleSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scheduling…</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4" />
                      <span>Confirm Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};


export default EquipmentDetails;