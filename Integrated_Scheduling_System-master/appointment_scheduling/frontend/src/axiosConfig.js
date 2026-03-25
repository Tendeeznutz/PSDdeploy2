import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000',
    withCredentials: true,  // Send HTTP-only cookies with every request
});

/**
 * Clear non-sensitive session data from localStorage.
 * JWT tokens are in HTTP-only cookies (not accessible to JS).
 */
function clearSessionData() {
    const keysToRemove = [
        'customers_id', 'customers_name',
        'technicians_id', 'technicians_name', 'technicians_phone', 'technicians_email',
        'coordinators_id', 'coordinators_name', 'coordinators_email',
        'role',
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Log out: call the server to blacklist the refresh token cookie,
 * then clear local session data and redirect to login.
 */
export async function logout() {
    try {
        await api.post('/api/auth/logout/');
    } catch (err) {
        // Server may be unreachable — still clear local state
    }
    clearSessionData();
    window.location.href = '/login';
}

// Handle 401 responses by attempting cookie-based token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // The refresh token is in an HTTP-only cookie — the browser sends it automatically
                await api.post('/api/token/refresh/');
                // New access token is set as a cookie by the server
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed — session expired
                clearSessionData();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
