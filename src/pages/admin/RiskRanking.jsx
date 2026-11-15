import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';

import {
  getRiskRanking,
  getEquipment,
  calculateAllRisks,
} from '../../services/api';


// ==================================================
// HELPERS
// ==================================================

/**
 * Derive a display status from a live risk_score.
 * Thresholds match Equipment.jsx and EquipmentDetails.jsx.
 */
const getDisplayStatus = (riskScore) => {
  const score = Number(riskScore ?? 0);
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'Warning';
  return 'Healthy';
};


// ==================================================
// STATUS BADGE
// ==================================================

const StatusBadge = ({ status }) => {
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
        styles[status] || 'bg-slate-100 text-slate-700 border-slate-200'
      )}
    >
      {status}
    </span>
  );
};


// ==================================================
// RISK RANKING PAGE
// ==================================================

const RiskRanking = () => {
  const navigate = useNavigate();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [ranking, setRanking] = useState([]);    // merged & sorted rows
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [recalculating, setRecalculating] = useState(false);
  const [recalcMessage, setRecalcMessage] = useState('');


  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  /**
   * Fetch ranking (sorted by risk desc) and equipment details,
   * then merge them into a single list keyed on equipment_id.
   *
   * GET /api/risk/ranking  → { count, ranking: [{ equipment_id, risk_score }] }
   * GET /api/equipment     → { count, equipment: [{ id, name, type, location,
   *                             health_score, risk_score, failure_count,
   *                             last_maintenance, status }] }
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setRecalcMessage('');

      const [rankingResponse, equipmentResponse] = await Promise.all([
        getRiskRanking(),
        getEquipment(),
      ]);

      const rankingList = Array.isArray(rankingResponse)
        ? rankingResponse
        : Array.isArray(rankingResponse?.ranking)
          ? rankingResponse.ranking
          : [];
      const equipmentList = Array.isArray(equipmentResponse)
        ? equipmentResponse
        : Array.isArray(equipmentResponse?.equipment)
          ? equipmentResponse.equipment
          : [];

      // Build a lookup map: equipment_id → equipment details
      const equipmentMap = {};
      for (const eq of equipmentList) {
        if (eq.id) {
          equipmentMap[eq.id] = eq;
        }
      }

      // Merge: ranking order is authoritative (highest risk first).
      // Fill in name, type, location, health_score, failure_count from equipment map.
      const merged = rankingList.map((entry) => {
        const eqId = entry.equipment_id;
        const details = equipmentMap[eqId] || {};

        const riskValue = Number(entry.risk_score ?? details.risk_score ?? 0);
        const healthValue = Number(details.health_score ?? 0);
        const failureValue = Number(details.failure_count ?? 0);
        const riskScore = Number.isFinite(riskValue) ? Math.min(100, Math.max(0, riskValue)) : 0;
        const healthScore = Number.isFinite(healthValue) ? Math.min(100, Math.max(0, healthValue)) : 0;
        const failureCount = Number.isFinite(failureValue) ? Math.max(0, failureValue) : 0;

        return {
          equipment_id: eqId,
          name: details.name || eqId,
          type: details.type || '—',
          location: details.location || '—',
          health_score: healthScore,
          risk_score: riskScore,
          failure_count: failureCount,
          status: getDisplayStatus(riskScore),
        };
      });

      setRanking(merged.sort((a, b) => b.risk_score - a.risk_score));
    } catch (err) {
      console.error('Failed to load risk ranking:', err);
      setError(err.message || 'Failed to load risk ranking.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // --------------------------------------------------
  // RECALCULATE ALL
  // --------------------------------------------------

  /**
   * POST /api/risk/calculate-all
   * Then reload fresh ranking so the table reflects updated scores.
   * NOT triggered automatically — only on explicit button click.
   */
  const handleRecalculateAll = async () => {
    try {
      setRecalculating(true);
      setRecalcMessage('');

      const result = await calculateAllRisks();

      const updatedCount = result?.count ?? 0;
      setRecalcMessage(
        `Risk scores recalculated for ${updatedCount} equipment item${updatedCount !== 1 ? 's' : ''}.`
      );

      // Reload to reflect updated scores
      await loadData();
    } catch (err) {
      setRecalcMessage(
        `Recalculation failed: ${err.message || 'Unknown error'}`
      );
    } finally {
      setRecalculating(false);
    }
  };


  // --------------------------------------------------
  // SUMMARY COUNTS (derived from live ranking)
  // --------------------------------------------------

  const highRiskCount = ranking.filter(
    (e) => e.status === 'High Risk' || e.status === 'Critical'
  ).length;

  const warningCount = ranking.filter(
    (e) => e.status === 'Warning'
  ).length;

  const healthyCount = ranking.filter(
    (e) => e.status === 'Healthy'
  ).length;


  // --------------------------------------------------
  // RENDER — LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p>Loading risk ranking…</p>
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
            Failed to load risk ranking
          </h2>

          <p className="text-sm mb-4">{error}</p>

          <button
            onClick={loadData}
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
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Risk Ranking
          </h1>

          <p className="text-slate-500 mt-1">
            Prioritize equipment using recorded failures and current health scores
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading || recalculating}
            title="Refresh risk ranking"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          {/* Recalculate All button */}
          <button
            onClick={handleRecalculateAll}
            disabled={recalculating || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {recalculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Recalculating…
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Recalculate All
              </>
            )}
          </button>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <Activity className="w-4 h-4 text-purple-500" />
            Powered by equipment risk scores
          </div>
        </div>
      </div>

      {/* Recalculation feedback */}
      {recalcMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 text-sm">
          {recalcMessage}
        </div>
      )}


      {/* ================================================
          INFO + SUMMARY CARDS
      ================================================ */}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">

        {/* Explanatory Card */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            How Risk is Calculated
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Failure component
              </p>
              <p className="text-sm font-semibold text-slate-800">
                min(failure count × 10, 50)
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Adds up to 50 points based on recorded equipment failures.
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Health component
              </p>
              <p className="text-sm font-semibold text-slate-800">
                (100 − health score) × 0.5
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Adds up to 50 points as the equipment health score decreases.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Final risk score = failure component + health component, clamped between 0 and 100.
            Critical: 70–100 · Warning: 40–69.99 · Healthy: below 40.
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Summary</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                High Risk / Critical
              </span>
              <span className="font-bold text-slate-900">
                {highRiskCount}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-500" />
                Warning
              </span>
              <span className="font-bold text-slate-900">
                {warningCount}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Healthy
              </span>
              <span className="font-bold text-slate-900">
                {healthyCount}
              </span>
            </div>
          </div>
        </div>

      </div>


      {/* ================================================
          RANKING TABLE
      ================================================ */}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">

            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-center w-16">
                  Rank
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
                <th className="px-6 py-4 font-semibold text-center">
                  Health Score
                </th>
                <th className="px-6 py-4 font-semibold text-center">
                  Risk Score
                </th>
                <th className="px-6 py-4 font-semibold">
                  Score Breakdown
                </th>
                <th className="px-6 py-4 font-semibold text-center">
                  Failures
                </th>
                <th className="px-6 py-4 font-semibold">
                  Status
                </th>
                <th className="px-6 py-4 font-semibold text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {ranking.map((eq, index) => {
                const rank = index + 1;
                const failureComponent = Math.min(Math.max(0, eq.failure_count) * 10, 50);
                const healthComponent = (100 - Math.min(100, Math.max(0, eq.health_score))) * 0.5;

                return (
                  <tr
                    key={eq.equipment_id}
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    onClick={() =>
                      navigate(`/admin/equipment/${eq.equipment_id}`)
                    }
                  >

                    {/* RANK */}
                    <td className="px-6 py-4 font-bold text-center">
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-full flex items-center justify-center mx-auto',
                          rank <= 3
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {rank}
                      </div>
                    </td>

                    {/* EQUIPMENT */}
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {eq.name}{' '}
                      <span className="text-slate-400 font-normal ml-1">
                        ({eq.equipment_id})
                      </span>
                    </td>

                    {/* TYPE */}
                    <td className="px-6 py-4">{eq.type}</td>

                    {/* LOCATION */}
                    <td className="px-6 py-4">{eq.location}</td>

                    {/* HEALTH SCORE */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={clsx(
                            'font-semibold w-8 text-right',
                            eq.health_score >= 70
                              ? 'text-green-600'
                              : eq.health_score >= 40
                                ? 'text-orange-500'
                                : 'text-red-600'
                          )}
                        >
                          {eq.health_score}%
                        </span>

                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full',
                              eq.health_score >= 70
                                ? 'bg-green-500'
                                : eq.health_score >= 40
                                  ? 'bg-orange-500'
                                  : 'bg-red-500'
                            )}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, eq.health_score)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* RISK SCORE */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={clsx(
                            'font-semibold w-8 text-right',
                            eq.risk_score >= 70
                              ? 'text-red-600'
                              : eq.risk_score >= 40
                                ? 'text-orange-500'
                                : 'text-green-600'
                          )}
                        >
                          {eq.risk_score}
                        </span>

                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full',
                              eq.risk_score >= 70
                                ? 'bg-red-500'
                                : eq.risk_score >= 40
                                  ? 'bg-orange-500'
                                  : 'bg-green-500'
                            )}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, eq.risk_score)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* SCORE BREAKDOWN */}
                    <td className="px-6 py-4 min-w-44">
                      <p className="text-xs text-slate-600">
                        Failures: <span className="font-semibold text-slate-800">{failureComponent.toFixed(1)}</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Health: <span className="font-semibold text-slate-800">{healthComponent.toFixed(1)}</span>
                      </p>
                    </td>

                    {/* FAILURES */}
                    <td className="px-6 py-4 font-semibold text-center text-slate-900">
                      {eq.failure_count}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-4">
                      <StatusBadge status={eq.status} />
                    </td>

                    {/* ACTION */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/admin/equipment/${eq.equipment_id}`
                          );
                        }}
                        className="text-blue-600 font-medium hover:text-blue-800 flex items-center justify-end gap-1 w-full"
                      >
                        View Details{' '}
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" />
                      </button>
                    </td>

                  </tr>
                );
              })}

              {/* EMPTY STATE */}
              {ranking.length === 0 && (
                <tr>
                  <td
                    colSpan="10"
                    className="px-6 py-16 text-center text-slate-500"
                  >
                    No equipment risk data available.
                    <br />
                    <span className="text-sm">
                      Seed the backend or recalculate risks to populate this list.
                    </span>
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default RiskRanking;
