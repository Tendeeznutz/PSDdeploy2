import {Link, useLocation, useNavigate} from 'react-router-dom';

function Navbar() {
    const location = useLocation();
    const hideOnRoutesCust = [
        '/home',
        '/scheduleAppointment',
        '/profile',
        '/appointmentDetail',
        '/rescheduleAppointment',
        '/ReportIssues',
        '/technicianhome',
        '/TechnicianHome',

        '/TechnicianProfile',
    ];
    const hideOnRoutesCoord = [
        '/CoordinatorHome',
        '/RegisterTechnician',
        '/CoordinatorAppointmentView',
        '/CustomerEnquiry',
        '/CoordinatorAppointmentUpdate'
    ]
    const navigate = useNavigate();

    if (localStorage.getItem('customers_id') || localStorage.getItem('technicians_phone')) {
        if (!hideOnRoutesCust.includes(location.pathname)) {
            return null;
        }
    } else if (localStorage.getItem('coordinators_email')) {
        if (!hideOnRoutesCoord.includes(location.pathname)) {
            return null;
        }
    }

    if (!hideOnRoutesCust.includes(location.pathname)) {
        return null;
    }

    const logout = () => {
        try {
            if (localStorage.getItem('customers_id') || localStorage.getItem('technicians_phone')) {
                localStorage.removeItem('customers_id');
                localStorage.removeItem('technicians_phone');
                localStorage.removeItem('technicians_id');
            } else if (localStorage.getItem('coordinators_email')) {
                localStorage.removeItem('coordinators_email');
            }
            navigate('/');
        } catch (err) {
            console.error(err.message);
        }
    };

    return (
        <header className="header">
            {/* Navigation Bar */}
            {localStorage.getItem('customers_id') || localStorage.getItem('technicians_phone') ? (
                <nav className="bg-gray-800 text-white p-4 mb-4 rounded">
                    <ul className="flex space-x-8 justify-center">
                        <li>
                            {localStorage.getItem('customers_id') ? (
                                <Link to="/home" className="hover:text-blue-300">
                                    Home
                                </Link>
                            ) : (
                                <Link to="/TechnicianHome" className="hover:text-blue-300">
                                    Home
                                </Link>
                            )}
                        </li>
                        {localStorage.getItem('customers_id') && (
                            <li>
                                <Link to="/scheduleAppointment" className="hover:text-blue-300">
                                    Add Appointment
                                </Link>
                            </li>
                        )}

                        {/*<li>*/}
                        {/*    <Link to="/TechnicianList" className="hover:text-blue-300">*/}
                        {/*        Technician List*/}
                        {/*    </Link>*/}
                        {/*</li>*/}
                        <li>
                            {localStorage.getItem('customers_id') ? (
                                    <Link to="/profile" className="hover:text-blue-300">
                                        Profile
                                    </Link>)
                                : (
                                    <Link to="/TechnicianProfile" className="hover:text-blue-300">
                                        Profile
                                    </Link>)}
                        </li>
                        <li>
                            <button onClick={logout} className="hover:text-blue-300">
                                Logout
                            </button>
                        </li>
                    </ul>
                </nav>
            ) : null}
            {localStorage.getItem('coordinators_email') ? (
                <nav className="bg-gray-800 text-white p-4 mb-4 rounded">
                    <ul className="flex space-x-8 justify-center">
                        <li>
                            <Link to="/CoordinatorHome" className="hover:text-blue-300">
                                Home
                            </Link>
                        </li>
                        <li>
                            <Link to="/RegisterTechnician" className="hover:text-blue-300">
                                Register Technician
                            </Link>
                        </li>
                        <li>
                            <button onClick={logout} className="hover:text-blue-300">
                                Logout
                            </button>
                        </li>
                    </ul>
                </nav>
            ) : null}
        </header>
    )
}

export default Navbar