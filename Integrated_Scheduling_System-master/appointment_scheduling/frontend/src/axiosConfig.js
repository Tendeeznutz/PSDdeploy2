import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000',
    withCredentials: true, // Send HTTP-only cookies with every request
});

// Handle 401 responses by attempting cookie-based token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Refresh endpoint reads the refresh cookie automatically
                await axios.post(
                    `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/token/refresh/`,
                    {},
                    { withCredentials: true }
                );

                // Retry the original request — new access cookie is set
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed — clear session and redirect
                clearSessionData();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

/**
 * Clear non-sensitive session data from localStorage.
 * JWT tokens are now in HTTP-only cookies (cleared server-side via /api/auth/logout/).
 */
export function clearSessionData() {
    const keys = [
        'customers_id', 'customers_name',
        'technicians_id', 'technicians_name', 'technicians_phone', 'technicians_email',
        'coordinators_id', 'coordinators_email', 'coordinators_name',
    ];
    keys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Call the server logout endpoint (blacklists refresh token + clears cookies),
 * then clear local session data.
 */
export async function logout() {
    try {
        await api.post('/api/auth/logout/');
    } catch {
        // Even if the server call fails, clear local state
    }
    clearSessionData();
}

export default api;
