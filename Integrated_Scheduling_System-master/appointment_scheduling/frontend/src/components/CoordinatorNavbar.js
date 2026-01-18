import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function CoordinatorNavbar() {
    const location = useLocation();
    const hideOnRoutes = [
        '/coordinatorHome',
        '/CoordinatorHome',
        '/RegisterTechnician',
        '/TechnicianHiring',
        '/CoordinatorAppointmentView',
        '/CustomerEnquiry',
        '/CoordinatorAppointmentUpdate'
    ];
    const navigate = useNavigate();

    if (!hideOnRoutes.includes(location.pathname)) {
        return null;
    }

    const logout = () => {
        try {
            localStorage.removeItem('coordinator_id');
            navigate('/');
        } catch (err) {
            console.error(err.message);
        }
    };

    return (
        <header className="header">
            {/* Navigation Bar */}
            <nav className="bg-gray-800 text-white p-4 mb-4 rounded">
                <ul className="flex space-x-8 justify-center">
                    <li>
                        <Link to="/coordinatorHome" className="hover:text-blue-300">
                            Home
                        </Link>
                    </li>
                    <li>
                        <Link to="/TechnicianHiring" className="hover:text-blue-300">
                            Hire Technician
                        </Link>
                    </li>
                    <li>
                        <button onClick={logout} className="hover:text-blue-300">
                            Logout
                        </button>
                    </li>
                </ul>
            </nav>
        </header>
    );
}

export default CoordinatorNavbar;
