import {Link, useLocation, useNavigate} from 'react-router-dom';
import { logout as serverLogout } from '../axiosConfig';

function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();

    const isCustomer = !!localStorage.getItem('customers_id');
    const isTechnician = !!localStorage.getItem('technicians_id');
    const isCoordinator = !!localStorage.getItem('coordinators_id');

    // Show navbar on any /customer/* or /technician/* route
    const showForCustOrTech = (isCustomer || isTechnician) &&
        (location.pathname.startsWith('/customer/') || location.pathname.startsWith('/technician/'));

    if (!showForCustOrTech) {
        return null;
    }

    const handleLogout = async () => {
        try {
            await serverLogout();
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
                        {isCustomer ? (
                            <Link to="/customer/home" className="hover:text-blue-300">
                                Home
                            </Link>
                        ) : (
                            <Link to="/technician/home" className="hover:text-blue-300">
                                Home
                            </Link>
                        )}
                    </li>
                    {isCustomer && (
                        <li>
                            <Link to="/customer/scheduleAppointment" className="hover:text-blue-300">
                                Add Appointment
                            </Link>
                        </li>
                    )}
                    <li>
                        {isCustomer ? (
                            <Link to="/customer/profile" className="hover:text-blue-300">
                                Profile
                            </Link>
                        ) : (
                            <Link to="/technician/profile" className="hover:text-blue-300">
                                Profile
                            </Link>
                        )}
                    </li>
                    <li>
                        {isCustomer ? (
                            <Link to="/customer/mailbox" className="hover:text-blue-300">
                                Mailbox
                            </Link>
                        ) : (
                            <Link to="/technician/mailbox" className="hover:text-blue-300">
                                Mailbox
                            </Link>
                        )}
                    </li>
                    <li>
                        <button onClick={handleLogout} className="hover:text-blue-300">
                            Logout
                        </button>
                    </li>
                </ul>
            </nav>
        </header>
    )
}

export default Navbar
