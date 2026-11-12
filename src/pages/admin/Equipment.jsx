import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronRight } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --------------------------------------------------
  // FETCH EQUIPMENT FROM BACKEND
  // --------------------------------------------------

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await getEquipment();

        setEquipment(data.equipment || []);
      } catch (err) {
        console.error('Failed to fetch equipment:', err);
        setError(err.message || 'Failed to load equipment.');
      } finally {
        setLoading(false);
      }
    };

    fetchEquipment();
  }, []);

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------

  const filteredEquipment = equipment.filter((eq) => {
    const search = searchTerm.toLowerCase();

    return (
      eq.name?.toLowerCase().includes(search) ||
      eq.id?.toLowerCase().includes(search) ||
      eq.location?.toLowerCase().includes(search)
    );
  });

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

          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex items-center gap-4 text-sm mb-4">
        <select className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
          <option value="">Equipment Type</option>
          <option value="Projector">Projector</option>
          <option value="Computer">Computer</option>
          <option value="AC">AC</option>
          <option value="Printer">Printer</option>
        </select>

        <select className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
          <option value="">Location</option>
          <option value="Lab 204">Lab 204</option>
          <option value="Block A">Block A</option>
          <option value="Computer Lab 2">Computer Lab 2</option>
          <option value="Admin Block">Admin Block</option>
        </select>

        <select className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
          <option value="">Status</option>
          <option value="Healthy">Healthy</option>
          <option value="Warning">Warning</option>
          <option value="Critical">Critical</option>
        </select>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          Failed to load equipment: {error}
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">

          {loading ? (
            <div className="px-6 py-12 text-center text-slate-500">
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
                        {eq.health_score}%
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
                        {eq.risk_score}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge
                        status={eq.status}
                        riskScore={eq.risk_score}
                      />
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {eq.last_maintenance}
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