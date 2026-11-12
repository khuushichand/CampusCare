const API_BASE_URL = "http://127.0.0.1:8000";

async function request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.detail?.message ||
            data?.detail ||
            data?.message ||
            "API request failed"
        );
    }

    return data;
}


// ==================================================
// EQUIPMENT
// ==================================================

export const getEquipment = () =>
    request("/api/equipment");

export const getEquipmentById = (equipmentId) =>
    request(`/api/equipment/${equipmentId}`);


// ==================================================
// RISK
// ==================================================

export const getRiskRanking = () =>
    request("/api/risk/ranking");

export const calculateRisk = (equipmentId) =>
    request(`/api/risk/${equipmentId}/calculate`);

export const calculateAllRisks = () =>
    request("/api/risk/calculate-all");


// ==================================================
// ALERTS
// ==================================================

export const getAlerts = () =>
    request("/api/alerts");

export const getAlert = (alertId) =>
    request(`/api/alerts/${alertId}`);

export const updateAlertStatus = (alertId, status) =>
    request(`/api/alerts/${alertId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });


// ==================================================
// REPORTS
// ==================================================

export const getReports = () =>
    request("/api/reports");

export const createReport = (report) =>
    request("/api/reports", {
        method: "POST",
        body: JSON.stringify(report),
    });


// ==================================================
// INCIDENTS
// ==================================================

export const getIncidents = () =>
    request("/api/incidents");

export const getIncident = (incidentId) =>
    request(`/api/incidents/${incidentId}`);

export const createIncident = (params) => {
    const query = new URLSearchParams(params).toString();

    return request(`/api/incidents?${query}`, {
        method: "POST",
    });
};

export const updateIncidentStatus = (incidentId, status) =>
    request(
        `/api/incidents/${incidentId}/status?status=${encodeURIComponent(status)}`,
        {
            method: "PATCH",
        }
    );


// ==================================================
// MAINTENANCE
// ==================================================

export const getMaintenance = () =>
    request("/api/maintenance");

export const getMaintenanceById = (maintenanceId) =>
    request(`/api/maintenance/${maintenanceId}`);

export const createMaintenance = (maintenance) =>
    request("/api/maintenance", {
        method: "POST",
        body: JSON.stringify(maintenance),
    });

export const updateMaintenanceStatus = (maintenanceId, status) =>
    request(`/api/maintenance/${maintenanceId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });


// ==================================================
// SETUP
// ==================================================

export const seedBackend = () =>
    request("/api/setup/seed", {
        method: "POST",
    });