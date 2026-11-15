// Central API Base URL supporting Vite environment variables
const API_BASE_URL =
    import.meta.env?.VITE_API_BASE_URL ||
    import.meta.env?.VITE_API_URL ||
    "http://127.0.0.1:8000";

export { API_BASE_URL };

/**
 * Resolves current user role from localStorage.
 * Returns null if no user is logged in.
 */
export const getActiveUserRole = () => {
    try {
        const stored = localStorage.getItem("campuscare_user");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.role) return parsed.role;
        }
    } catch {
        // Return null if malformed or missing
    }
    return null;
};

/**
 * Resolves current student identity from localStorage.
 * Returns null if no student is logged in (no silent impersonation).
 */
export const getActiveStudentId = () => {
    try {
        const stored = localStorage.getItem("campuscare_user");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.usn) return parsed.usn;
            if (parsed?.student_id) return parsed.student_id;
        }
    } catch {
        // Return null if malformed or missing
    }
    return null;
};

/**
 * Central HTTP request wrapper.
 * Handles network failures, non-JSON responses, and structured FastAPI error payloads.
 * Properly merges options and headers so custom headers take precedence without overwriting defaults.
 * Automatically injects X-Student-Id and X-User-Role from the active demo session.
 */
async function request(endpoint, options = {}) {
    const studentId = getActiveStudentId();
    const userRole = getActiveUserRole();

    // Construct default headers
    const isFormData = options.body instanceof FormData;

    const defaultHeaders = isFormData
        ? {}
        : {
            "Content-Type": "application/json",
        };

    if (studentId) {
        defaultHeaders["X-Student-Id"] = studentId;
    }

    if (userRole) {
        defaultHeaders["X-User-Role"] = userRole;
    }

    // Merge custom headers over default headers
    const mergedHeaders = {
        ...defaultHeaders,
        ...(options.headers || {}),
    };

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: mergedHeaders,
        });
    } catch (networkError) {
        throw new Error(
            networkError.message
                ? `Network connection error: ${networkError.message}`
                : "Unable to connect to CampusCare backend. Please ensure the server is running."
        );
    }

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch {
            data = null;
        }
    } else {
        const text = await response.text();
        data = { message: text };
    }

    if (!response.ok) {
        let errorMessage = "API request failed";
        if (data) {
            if (typeof data.detail === "string") {
                errorMessage = data.detail;
            } else if (Array.isArray(data.detail)) {
                // FastAPI pydantic validation error array
                errorMessage = data.detail.map(err => err.msg || JSON.stringify(err)).join("; ");
            } else if (data.detail?.message) {
                errorMessage = data.detail.message;
            } else if (data.message) {
                errorMessage = data.message;
            }
        } else {
            errorMessage = `HTTP error ${response.status}: ${response.statusText || "Request failed"}`;
        }
        throw new Error(errorMessage);
    }

    return data;
}


// ==================================================
// HEALTH CHECK
// ==================================================

export const checkHealth = () =>
    request("/health");


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
    request(`/api/risk/${equipmentId}/calculate`, {
        method: "POST",
    });

export const calculateAllRisks = () =>
    request("/api/risk/calculate-all", {
        method: "POST",
    });


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

export const getMyReports = () =>
    request("/api/reports/me");

export const getReportById = (reportId) =>
    request(`/api/reports/${reportId}`);

export const createReport = (report) =>
    request("/api/reports", {
        method: "POST",
        body: JSON.stringify(report),
    });
export const uploadReportImage = (reportId, file) => {
    const formData = new FormData();
    formData.append("file", file);

    return request(`/api/reports/${reportId}/image`, {
        method: "POST",
        body: formData,
    });
};

// ==================================================
// INCIDENTS
// ==================================================

export const getIncidents = () =>
    request("/api/incidents");

export const getIncident = (incidentId) =>
    request(`/api/incidents/${incidentId}`);

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
// ANALYTICS (Phase 5)
// ==================================================

export const getHotspotAnalytics = () =>
    request("/api/analytics/hotspots");


// ==================================================
// SETUP
// ==================================================

export const seedBackend = () =>
    request("/api/setup/seed", {
        method: "POST",
    });
