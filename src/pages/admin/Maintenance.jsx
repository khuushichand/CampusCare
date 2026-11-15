import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Loader2,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';
import clsx from 'clsx';

import {
  getMaintenance,
  getEquipment,
  createMaintenance,
  updateMaintenanceStatus,
} from '../../services/api';


// ==================================================
// CONSTANTS
// ==================================================

/**
 * Backend allowed statuses for PATCH /api/maintenance/{id}/status
 * Source: maintenance.py allowed_statuses set
 */
const BACKEND_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const STATUS_LABELS = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const getStatusLabel = (status) =>
  STATUS_LABELS[String(status || '').toUpperCase()] || status || '—';


// ==================================================
// HELPERS
// ==================================================

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      dateStyle: 'medium',
    });
  } catch {
    return dateStr;
  }
};


// ==================================================
// STATUS BADGE
// ==================================================

const StatusBadge = ({ status }) => {
  const upper = String(status || '').toUpperCase();
  const styles = {
    COMPLETED: 'bg-green-100 text-green-700 border-green-200',
    SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
    IN_PROGRESS: 'bg-purple-100 text-purple-700 border-purple-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-full text-xs font-semibold border',
        styles[upper] || 'bg-slate-100 text-slate-700 border-slate-200'
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
};


// ==================================================
// STAT CARD
// ==================================================

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
    <div className="flex items-center gap-3 mb-3">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', color.bg)}>
        <Icon className={clsx('w-5 h-5', color.text)} />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
    </div>
    <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
  </div>
);


// ==================================================
// FILTER TABS
// ==================================================

const FILTER_TABS = ['All', ...BACKEND_STATUSES];

const matchesFilter = (record, filter) => {
  if (filter === 'All') return true;
  return String(record.status || '').toUpperCase() === filter;
};


// ==================================================
// MAINTENANCE PAGE
// ==================================================

const Maintenance = () => {
  const navigate = useNavigate();

  // --------------------------------------------------
  // STATE — LIST
  // --------------------------------------------------

  const [records, setRecords] = useState([]);
  const [equipmentMap, setEquipmentMap] = useState({});
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [updating, setUpdating] = useState({});
  const [updateErrors, setUpdateErrors] = useState({});

  // --------------------------------------------------
  // STATE — CREATE FORM
  // --------------------------------------------------

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    equipment_id: '',
    title: '',
    description: '',
    technician: '',
    scheduled_date: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');


  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  /**
   * GET /api/maintenance → { count, maintenance: [...] }
   * GET /api/equipment   → { count, equipment: [...] }
   *
   * Maintenance records store equipment_id but not name/location.
   * Equipment details are merged client-side by equipment_id.
   */
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setRefreshError('');
    } else {
      setLoading(true);
      setError('');
    }

    try {
      const [maintenanceResponse, equipmentResponse] = await Promise.all([
        getMaintenance(),
        getEquipment(),
      ]);

      const maintenanceList = Array.isArray(maintenanceResponse)
        ? maintenanceResponse
        : Array.isArray(maintenanceResponse?.maintenance)
          ? maintenanceResponse.maintenance
          : [];

      const equipmentList = Array.isArray(equipmentResponse)
        ? equipmentResponse
        : Array.isArray(equipmentResponse?.equipment)
          ? equipmentResponse.equipment
          : [];

      const eqMap = {};
      for (const eq of equipmentList) {
        if (eq?.id) eqMap[eq.id] = eq;
      }

      const sorted = maintenanceList.slice().sort((a, b) => {
        const dateA = String(a?.scheduled_date || '');
        const dateB = String(b?.scheduled_date || '');
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return String(b?.maintenance_id || '').localeCompare(
          String(a?.maintenance_id || '')
        );
      });

      setRecords(sorted);
      setEquipmentMap(eqMap);
      setLastUpdated(new Date());
      setError('');
      setRefreshError('');
    } catch (err) {
      console.error('Failed to load maintenance records:', err);
      const message = err.message || 'Failed to load maintenance records.';
      if (records.length > 0 || isRefresh) {
        setRefreshError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // --------------------------------------------------
  // FILTER + SEARCH
  // --------------------------------------------------

  const filteredRecords = records.filter((m) => {
    if (!matchesFilter(m, filter)) return false;
    if (!searchTerm.trim()) return true;

    const search = searchTerm.toLowerCase();
    const eq = equipmentMap[m.equipment_id] || {};

    return (
      (m.maintenance_id || '').toLowerCase().includes(search) ||
      (m.equipment_id || '').toLowerCase().includes(search) ||
      (eq.name || '').toLowerCase().includes(search) ||
      (eq.location || '').toLowerCase().includes(search) ||
      (m.title || '').toLowerCase().includes(search) ||
      (m.technician || '').toLowerCase().includes(search)
    );
  });

  const countByStatus = (status) =>
    records.filter(
      (m) => String(m.status || '').toUpperCase() === status
    ).length;


  // --------------------------------------------------
  // STATUS UPDATE
  // --------------------------------------------------

  /**
   * PATCH /api/maintenance/{id}/status
   * Body: { "status": "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }
   *
   * When COMPLETED the backend also updates equipment's last_maintenance
   * date and recalculates its risk score automatically.
   */
  const handleStatusChange = async (maintenanceId, newStatus) => {
    if (updating[maintenanceId]) return;
    const existingRecord = records.find((record) => record.maintenance_id === maintenanceId);
    if (String(existingRecord?.status || '').toUpperCase() === newStatus) return;

    setUpdating((prev) => ({ ...prev, [maintenanceId]: true }));
    setUpdateErrors((prev) => ({ ...prev, [maintenanceId]: '' }));

    try {
      const result = await updateMaintenanceStatus(maintenanceId, newStatus);
      const responseRecord = result?.maintenance || result?.record || result || {};

      setRecords((prev) =>
        prev.map((record) =>
          record.maintenance_id === maintenanceId
            ? { ...record, ...responseRecord, status: responseRecord.status || newStatus }
            : record
        )
      );
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to update maintenance status:', err);
      setUpdateErrors((prev) => ({
        ...prev,
        [maintenanceId]: err.message || 'Update failed',
      }));
    } finally {
      setUpdating((prev) => ({ ...prev, [maintenanceId]: false }));
    }
  };


  // --------------------------------------------------
  // CREATE MAINTENANCE
  // --------------------------------------------------

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * POST /api/maintenance
   * Body: { equipment_id, title, description, technician, scheduled_date }
   * status defaults to "SCHEDULED" on the backend.
   */
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    for (const [key, val] of Object.entries(formData)) {
      if (!val.trim()) {
        setFormError(`"${key.replace(/_/g, ' ')}" is required.`);
        return;
      }
    }

    if (
      Object.keys(equipmentMap).length > 0 &&
      !equipmentMap[formData.equipment_id.trim()]
    ) {
      setFormError(
        `Equipment ID "${formData.equipment_id}" not found. Known IDs: ${Object.keys(equipmentMap).join(', ')}.`
      );
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      await createMaintenance({
        equipment_id: formData.equipment_id.trim(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        technician: formData.technician.trim(),
        scheduled_date: formData.scheduled_date.trim(),
      });

      setFormData({
        equipment_id: '',
        title: '',
        description: '',
        technician: '',
        scheduled_date: '',
      });
      setShowForm(false);

      await loadData();
    } catch (err) {
      console.error('Failed to create maintenance record:', err);
      setFormError(err.message || 'Failed to create maintenance record.');
    } finally {
      setFormSubmitting(false);
    }
  };


  // --------------------------------------------------
  // RENDER — LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p>Loading maintenance records…</p>
      </div>
    );
  }


  // --------------------------------------------------
  // RENDER — ERROR
  // --------------------------------------------------

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
          <h2 className="font-bold text-lg mb-2">
            Failed to load maintenance records
          </h2>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }


  // --------------------------------------------------
  // RENDER — MAIN
  // --------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ================================================
          HEADER
      ================================================ */}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-slate-500 mt-1">
            Track scheduled and completed equipment maintenance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          <button
            onClick={() => { setShowForm(true); setFormError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Maintenance
          </button>
        </div>
      </div>


      {/* ================================================
          STAT CARDS (live counts)
      ================================================ */}

      {refreshError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Could not refresh the latest data: {refreshError}. Showing the last successfully loaded records.</span>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="shrink-0 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {lastUpdated && (
        <p className="text-xs text-slate-400 text-right">
          Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Scheduled"
          value={countByStatus('SCHEDULED')}
          icon={Calendar}
          color={{ bg: 'bg-blue-50', text: 'text-blue-600' }}
        />
        <StatCard
          title="In Progress"
          value={countByStatus('IN_PROGRESS')}
          icon={Activity}
          color={{ bg: 'bg-purple-50', text: 'text-purple-600' }}
        />
        <StatCard
          title="Completed"
          value={countByStatus('COMPLETED')}
          icon={CheckCircle2}
          color={{ bg: 'bg-green-50', text: 'text-green-600' }}
        />
        <StatCard
          title="Cancelled"
          value={countByStatus('CANCELLED')}
          icon={AlertTriangle}
          color={{ bg: 'bg-red-50', text: 'text-red-600' }}
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ================================================
            MAIN TABLE
        ================================================ */}

        <div className="lg:col-span-3 space-y-4">

          {/* Search input */}
          <input
            type="text"
            placeholder="Search by ID, equipment, technician…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  filter === f
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                )}
              >
                {f === 'All' ? 'All' : getStatusLabel(f)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">

                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">ID</th>
                    <th className="px-6 py-4 font-semibold">Equipment &amp; Location</th>
                    <th className="px-6 py-4 font-semibold">Title</th>
                    <th className="px-6 py-4 font-semibold">Scheduled Date</th>
                    <th className="px-6 py-4 font-semibold">Technician</th>
                    <th className="px-6 py-4 font-semibold">Status / Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((m) => {
                    const maintenanceId = m.maintenance_id;
                    const eq = equipmentMap[m.equipment_id] || {};
                    const isUpdating = !!updating[maintenanceId];
                    const updateErr = updateErrors[maintenanceId];
                    const currentStatus = String(m.status || '').toUpperCase();

                    return (
                      <tr
                        key={maintenanceId}
                        className="hover:bg-slate-50/70 transition-colors"
                      >

                        {/* ID */}
                        <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                          {maintenanceId}
                        </td>

                        {/* Equipment & Location */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              navigate(`/admin/equipment/${m.equipment_id}`)
                            }
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline block mb-1"
                          >
                            {m.equipment_id}
                            {eq.name && (
                              <span className="text-slate-500 font-normal ml-1">
                                {eq.name}
                              </span>
                            )}
                          </button>
                          {eq.location && (
                            <span className="text-slate-500 text-xs">
                              {eq.location}
                            </span>
                          )}
                        </td>

                        {/* Title + description */}
                        <td className="px-6 py-4 font-medium text-slate-700">
                          <div>{m.title || '—'}</div>
                          {m.description && (
                            <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">
                              {m.description}
                            </div>
                          )}
                        </td>

                        {/* Scheduled Date */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Calendar className="w-4 h-4" />
                            {formatDate(m.scheduled_date)}
                          </div>
                        </td>

                        {/* Technician */}
                        <td className="px-6 py-4">{m.technician || '—'}</td>

                        {/* Status + update select */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2 items-start">
                            <StatusBadge status={m.status} />

                            <select
                              value={currentStatus}
                              onChange={(e) =>
                                handleStatusChange(maintenanceId, e.target.value)
                              }
                              disabled={isUpdating}
                              className="bg-slate-50 border border-slate-200 text-xs rounded p-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {BACKEND_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  Set {getStatusLabel(s)}
                                </option>
                              ))}
                            </select>

                            {isUpdating && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Saving…
                              </span>
                            )}

                            {updateErr && (
                              <span className="text-[10px] text-red-500">
                                {updateErr}
                              </span>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}

                  {/* Empty state */}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        {records.length === 0
                          ? 'No maintenance records yet. Use "Schedule Maintenance" to log a new record.'
                          : 'No records match your current search or filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>

              </table>
            </div>
          </div>
        </div>


        {/* ================================================
            SIDE INFO CARD
        ================================================ */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit space-y-6">

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600" />
              </div>
              <h3 className="font-bold text-slate-900">Predictive Maintenance</h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Maintenance priorities are informed by equipment health,
              risk scores, historical failures and recent issue activity.
              Completing a record automatically updates the equipment's
              last maintenance date and recalculates its risk score.
            </p>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
              <ArrowRight className="w-4 h-4" />
              Backend integrated
            </div>
          </div>

          {/* Quick totals */}
          <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Total Records
            </h4>
            <div className="flex justify-between">
              <span className="text-slate-600">All</span>
              <span className="font-bold text-slate-900">{records.length}</span>
            </div>
            {BACKEND_STATUSES.map((s) => (
              <div key={s} className="flex justify-between">
                <span className="text-slate-600">{getStatusLabel(s)}</span>
                <span className="font-bold text-slate-900">
                  {countByStatus(s)}
                </span>
              </div>
            ))}
          </div>

        </div>

      </div>


      {/* ================================================
          SCHEDULE MAINTENANCE MODAL
      ================================================ */}

      {showForm && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Schedule Maintenance
              </h2>
              <button
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="px-6 py-5 space-y-4">

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {formError}
                </div>
              )}

              {/* Equipment ID */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Equipment ID <span className="text-red-500">*</span>
                </label>
                <input
                  name="equipment_id"
                  value={formData.equipment_id}
                  onChange={handleFormChange}
                  placeholder={
                    Object.keys(equipmentMap).length > 0
                      ? `e.g. ${Object.keys(equipmentMap)[0]}`
                      : 'e.g. P001'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {Object.keys(equipmentMap).length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Available: {Object.keys(equipmentMap).join(', ')}
                  </p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Maintenance Title <span className="text-red-500">*</span>
                </label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="e.g. Routine Inspection"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Describe the maintenance task…"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Technician */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Technician / Team <span className="text-red-500">*</span>
                </label>
                <input
                  name="technician"
                  value={formData.technician}
                  onChange={handleFormChange}
                  placeholder="e.g. IT Support"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Scheduled Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Scheduled Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(''); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Schedule'
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

export default Maintenance;
