import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function CoordinatorNavbar() {
    const location = useLocation();
    const navigate = useNavigate();

    const isCoordinator = !!localStorage.getItem('coordinators_email');

    // Show navbar on any /coordinator/* route
    if (!isCoordinator || !location.pathname.startsWith('/coordinator/')) {
        return null;
    }

    const logout = () => {
        try {
            localStorage.removeItem('coordinators_id');
            localStorage.removeItem('coordinators_email');
            localStorage.removeItem('coordinators_name');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            navigate('/');
        } catch (err) {
            console.error(err.message);
        }
    };

    return (
        <header className="header">
            <nav className="bg-gray-800 text-white p-4 mb-4 rounded">
                <ul className="flex space-x-8 justify-center">
                    <li>
                        <Link to="/coordinator/home" className="hover:text-blue-300">
                            Home
                        </Link>
                    </li>
                    <li>
                        <Link to="/coordinator/technicianHiring" className="hover:text-blue-300">
                            Hire Technician
                        </Link>
                    </li>
                    <li>
                        <Link to="/coordinator/mailbox" className="hover:text-blue-300">
                            Mailbox
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
