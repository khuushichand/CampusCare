import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronRight, Loader2, RefreshCw, Activity, Wrench, HeartPulse, Boxes, X } from 'lucide-react';
import clsx from 'clsx';
import { getEquipment } from '../../services/api';

const StatusBadge = ({ status, riskScore }) => {
  let displayStatus = status;

  // Backend status + risk score → frontend display status
  if (riskScore >= 70) {
    displayStatus = 'Critical';
  } else if (riskScore >= 40) {
    displayStatus = 'Warning';
  } else {
    displayStatus = 'Healthy';
  }

  const styles = {
    Healthy: 'bg-green-100 text-green-700 border-green-200',
    Warning: 'bg-orange-100 text-orange-700 border-orange-200',
    'High Risk': 'bg-red-50 text-red-600 border-red-200',
    Critical: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-full text-xs font-semibold border',
        styles[displayStatus] ||
        'bg-slate-100 text-slate-700 border-slate-200'
      )}
    >
      {displayStatus}
    </span>
  );
};

const Equipment = () => {
  const navigate = useNavigate();

  const [equipment, setEquipment] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // --------------------------------------------------
  // FETCH EQUIPMENT FROM BACKEND
  // --------------------------------------------------

  const fetchEquipment = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getEquipment();

      const list = Array.isArray(data) ? data : data?.equipment;
      setEquipment(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch equipment:', err);
      setError(err.message || 'Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  // --------------------------------------------------
  // SEARCH, FILTERS + LIVE SUMMARY METRICS
  // --------------------------------------------------

  const getRiskScore = (eq) => {
    const value = Number(eq.risk_score);
    return Number.isFinite(value) ? value : 0;
  };

  const getHealthScore = (eq) => {
    const value = Number(eq.health_score);
    return Number.isFinite(value) ? value : 0;
  };

  const getDisplayStatus = (eq) => {
    const riskScore = getRiskScore(eq);
    if (riskScore >= 70) return 'Critical';
    if (riskScore >= 40) return 'Warning';
    return 'Healthy';
  };

  const filteredEquipment = equipment.filter((eq) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      String(eq.name || '').toLowerCase().includes(search) ||
      String(eq.id || '').toLowerCase().includes(search) ||
      String(eq.location || '').toLowerCase().includes(search) ||
      String(eq.type || '').toLowerCase().includes(search);

    const matchesType =
      !typeFilter ||
      String(eq.type || '').toLowerCase() === typeFilter.toLowerCase();

    const matchesLocation =
      !locationFilter ||
      String(eq.location || '').toLowerCase() === locationFilter.toLowerCase();

    const matchesStatus =
      !statusFilter || getDisplayStatus(eq) === statusFilter;

    return matchesSearch && matchesType && matchesLocation && matchesStatus;
  });

  const uniqueTypes = [...new Set(equipment.map((eq) => eq.type).filter(Boolean))];
  const uniqueLocations = [...new Set(equipment.map((eq) => eq.location).filter(Boolean))];

  const criticalCount = equipment.filter((eq) => getDisplayStatus(eq) === 'Critical').length;
  const warningCount = equipment.filter((eq) => getDisplayStatus(eq) === 'Warning').length;
  const averageHealth = equipment.length
    ? Math.round(equipment.reduce((total, eq) => total + getHealthScore(eq), 0) / equipment.length)
    : 0;

  const hasActiveFilters = Boolean(searchTerm || typeFilter || locationFilter || statusFilter);
  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('');
    setLocationFilter('');
    setStatusFilter('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Equipment
          </h1>

          <p className="text-slate-500 mt-1">
            Monitor campus equipment health and maintenance status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-600" />}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/risk-ranking')}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Risk Ranking
          </button>
          <button
            type="button"
            onClick={fetchEquipment}
            disabled={loading}
            title="Refresh equipment"
            className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* LIVE EQUIPMENT SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Total Equipment</p>
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{equipment.length}</p>
          <p className="text-xs text-slate-400 mt-1">Registered campus assets</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Critical Risk</p>
            <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-3">{criticalCount}</p>
          <p className="text-xs text-slate-400 mt-1">Risk score of 70 or above</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Needs Attention</p>
            <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-bold text-orange-600 mt-3">{warningCount}</p>
          <p className="text-xs text-slate-400 mt-1">Risk score between 40 and 69</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Average Health</p>
            <span className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{averageHealth}%</p>
          <p className="text-xs text-slate-400 mt-1">Across registered equipment</p>
        </div>
      </div>

      {/* FILTERS */}
      {showFilters && <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
        <select
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Equipment Type</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">Location</option>
            {uniqueLocations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Status</option>
            <option value="Healthy">Healthy</option>
            <option value="Warning">Warning</option>
            <option value="Critical">Critical</option>
          </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:text-blue-800 font-medium"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>}

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-center justify-between">
          <span>Failed to load equipment: {error}</span>
          <button
            onClick={fetchEquipment}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900 ml-4"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900">Equipment Inventory</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredEquipment.length} of {equipment.length} assets
            </p>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              Reset search and filters
            </button>
          )}
        </div>
        <div className="overflow-x-auto">

          {loading ? (
            <div className="px-6 py-12 text-center text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              Loading equipment...
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">

              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">
                    Equipment ID
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Equipment
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Type
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Location
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Health Score
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Risk Score
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Status
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Last Maint.
                  </th>

                  <th className="px-6 py-4 font-semibold text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredEquipment.map((eq) => (
                  <tr
                    key={eq.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >

                    <td className="px-6 py-4 font-medium text-slate-900">
                      {eq.id}
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-900">
                      {eq.name}
                    </td>

                    <td className="px-6 py-4">
                      {eq.type}
                    </td>

                    <td className="px-6 py-4">
                      {eq.location}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'font-semibold',
                          eq.health_score >= 70
                            ? 'text-green-600'
                            : eq.health_score >= 40
                              ? 'text-orange-500'
                              : 'text-red-600'
                        )}
                      >
                        {getHealthScore(eq)}%
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'font-semibold',
                          eq.risk_score >= 70
                            ? 'text-red-600'
                            : eq.risk_score >= 40
                              ? 'text-orange-500'
                              : 'text-green-600'
                        )}
                      >
                        {getRiskScore(eq)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge
                        status={eq.status}
                        riskScore={getRiskScore(eq)}
                      />
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {eq.last_maintenance || 'Not recorded'}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() =>
                          navigate(`/admin/equipment/${eq.id}`)
                        }
                        className="text-blue-600 font-medium hover:text-blue-800 flex items-center justify-end gap-1 w-full"
                      >
                        View Details

                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" />
                      </button>
                    </td>

                  </tr>
                ))}

                {!loading && filteredEquipment.length === 0 && (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No equipment found matching your criteria.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>
          )}

        </div>
      </div>

    </div>
  );
};

export default Equipment;