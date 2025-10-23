import { useNavigate } from "react-router-dom";
import { Result } from 'antd'; 

function Error404() {
    const navigate = useNavigate();
    const customerId = localStorage.getItem('customer_id');

    return (
			<div>
        {customerId && (
					<Result
						status="404"
						title="404"
						subTitle="Sorry, the page you visited does not exist."
						extra={<button className="sm:w-full lg:w-auto my-2 border rounded md py-4 px-8 text-center bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:ring-opacity-50" onClick={() => navigate('/home')}>Take me there!</button>}
					> 
					</Result>
				)}

				{!customerId && (
					<Result
						status="403"
						title="403"
						subTitle="Sorry, you are not authorized to access this page."
						extra={<button className="sm:w-full lg:w-auto my-2 border rounded md py-4 px-8 text-center bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:ring-opacity-50" onClick={() => navigate('/')}>Take me there!</button>}
					> 
					</Result>
				)}
      </div>
    )
}

export default Error404;