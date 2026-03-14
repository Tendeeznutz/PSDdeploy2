import { useNavigate } from "react-router-dom";
import { Result } from 'antd';

function Error404() {
    const navigate = useNavigate();
    const customerId = localStorage.getItem('customers_id');
    const coordinatorId = localStorage.getItem('coordinators_id');
    const technicianId = localStorage.getItem('technicians_id');

    // Determine if any user is logged in and their home page
    const isLoggedIn = customerId || coordinatorId || technicianId;

    const getHomePage = () => {
        if (customerId) return '/customer/home';
        if (coordinatorId) return '/coordinator/home';
        if (technicianId) return '/technician/home';
        return '/login';
    };

    const getUserType = () => {
        if (customerId) return 'Customer';
        if (coordinatorId) return 'Coordinator';
        if (technicianId) return 'Technician';
        return null;
    };

    return (
        <div>
            {isLoggedIn ? (
                <Result
                    status="404"
                    title="404"
                    subTitle="Sorry, the page you visited does not exist."
                    extra={
                        <button
                            className="sm:w-full lg:w-auto my-2 border rounded md py-4 px-8 text-center bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:ring-opacity-50"
                            onClick={() => navigate(getHomePage())}
                        >
                            Back to {getUserType()} Home
                        </button>
                    }
                />
            ) : (
                <Result
                    status="403"
                    title="403"
                    subTitle="Sorry, you are not authorized to access this page."
                    extra={
                        <button
                            className="sm:w-full lg:w-auto my-2 border rounded md py-4 px-8 text-center bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:ring-opacity-50"
                            onClick={() => navigate('/login')}
                        >
                            Go to Login
                        </button>
                    }
                />
            )}
        </div>
    );
}

export default Error404;