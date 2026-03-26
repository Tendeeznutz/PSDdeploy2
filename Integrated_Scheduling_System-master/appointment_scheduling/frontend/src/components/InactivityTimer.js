import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout as serverLogout } from '../axiosConfig';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // 2 minutes before logout (show at 3 min inactivity)

function InactivityTimer() {
    const [showWarning, setShowWarning] = useState(false);
    const [remainingTime, setRemainingTime] = useState(WARNING_TIME);
    const navigate = useNavigate();
    const location = useLocation();

    const timeoutRef = useRef(null);
    const warningTimeoutRef = useRef(null);
    const countdownRef = useRef(null);

    // Check if user is logged in via session data (tokens are in HTTP-only cookies)
    const isLoggedIn = () => {
        return !!(
            localStorage.getItem('customers_id') ||
            localStorage.getItem('technicians_id') ||
            localStorage.getItem('coordinators_id')
        );
    };

    // Clear all auth data on logout
    const logout = useCallback(async () => {
        await serverLogout();
        setShowWarning(false);
        navigate('/login');
    }, [navigate]);

    const resetTimer = useCallback(() => {
        // Don't reset if not logged in
        if (!isLoggedIn()) return;

        // Clear existing timers
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);

        // Hide warning if showing
        setShowWarning(false);
        setRemainingTime(WARNING_TIME);

        // Set warning timer (at 3 minutes of inactivity)
        warningTimeoutRef.current = setTimeout(() => {
            if (isLoggedIn()) {
                setShowWarning(true);
                setRemainingTime(WARNING_TIME);

                // Start countdown
                countdownRef.current = setInterval(() => {
                    setRemainingTime(prev => {
                        if (prev <= 1000) {
                            clearInterval(countdownRef.current);
                            return 0;
                        }
                        return prev - 1000;
                    });
                }, 1000);
            }
        }, INACTIVITY_TIMEOUT - WARNING_TIME);

        // Set logout timer (at 5 minutes of inactivity)
        timeoutRef.current = setTimeout(() => {
            if (isLoggedIn()) {
                logout();
            }
        }, INACTIVITY_TIMEOUT);
    }, [logout]);

    const handleStayLoggedIn = () => {
        resetTimer();
    };

    const handleLogoutNow = () => {
        logout();
    };

    // Format remaining time as MM:SS
    const formatTime = (ms) => {
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        // Only set up listeners if logged in
        if (!isLoggedIn()) return;

        // Activity events to track
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

        // Throttle reset to avoid excessive calls
        const lastResetRef = { current: Date.now() };
        const throttledReset = () => {
            const now = Date.now();
            if (now - lastResetRef.current > 1000) { // Only reset every 1 second max
                lastResetRef.current = now;
                resetTimer();
            }
        };

        // Add event listeners
        events.forEach(event => {
            document.addEventListener(event, throttledReset, { passive: true });
        });

        // Initialize timer
        resetTimer();

        // Cleanup
        return () => {
            events.forEach(event => {
                document.removeEventListener(event, throttledReset);
            });
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [resetTimer, location.pathname]);

    // Don't render if not logged in
    if (!isLoggedIn()) return null;

    return (
        <Modal
            title="Session Timeout Warning"
            open={showWarning}
            closable={false}
            maskClosable={false}
            footer={[
                <Button key="logout" onClick={handleLogoutNow}>
                    Logout Now
                </Button>,
                <Button key="stay" type="primary" onClick={handleStayLoggedIn}>
                    Stay Logged In
                </Button>
            ]}
        >
            <div className="text-center">
                <p className="text-lg mb-4">
                    You have been inactive for a while.
                </p>
                <p className="text-2xl font-bold text-red-500 mb-4">
                    {formatTime(remainingTime)}
                </p>
                <p className="text-gray-600">
                    You will be automatically logged out due to inactivity.
                    Click "Stay Logged In" to continue your session.
                </p>
            </div>
        </Modal>
    );
}

export default InactivityTimer;
