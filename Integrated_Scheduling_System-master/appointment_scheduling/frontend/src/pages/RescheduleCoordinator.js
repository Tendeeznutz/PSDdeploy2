import React, {useState, useEffect} from 'react';
import api from "../axiosConfig";
import DatePicker from 'react-datepicker';
import { useNavigate } from 'react-router-dom';

function RescheduleCoordinator() {
    const [technicianData, setTechnicianData] = useState({});
    const [dateTime, setDateTime] = useState('');
    const [selectedAircons, setSelectedAircons] = useState([]);
    const [airconData, setAirconData] = useState([]);
    const [reason, setReason] = useState('');
    const [remark, setRemark] = useState('');
    const [customerData, setCustomerData] = useState({});
    const [apptStatus, setApptStatus] = useState('');

    const [error, setError] = useState('');
    const navigate = useNavigate();

    const apptId = new URLSearchParams(window.location.search).get('id');
    const custId = new URLSearchParams(window.location.search).get('cust_id');

    useEffect(() => {
        const fetchAirconData = async () => {
            try {
                const response = await api.get(`/api/customeraircondevices/?customerId=` + custId);
                setAirconData(response.data);
            } catch (error) {
                console.error('Error fetching aircon data:', error);
            }
        };

        const fetchAppointmentData = async () => {
            try {
                const response = await api.get(`/api/appointments/` + apptId + `/`);
                // setDateTime(new Date(response.data.dateTime));
                setSelectedAircons(response.data.airconToService);
                setTechnicianData({
                    technicianId: response.data.technicianId,
                    technicianName: response.data.technicianName
                });
                setCustomerData({
                    customerId: response.data.customerId,
                    customerName: response.data.customerName
                });
                setApptStatus(response.data.appointmentStatus);
            } catch (error) {
                console.error("Error fetching appointment data: ", error);
            }
        }

        const fetchReqDateTime = async () => {
            try {
                const reqDateTimeUrl = await api.get(`/api/rescheduleappointment/getRescheduleRequest/?id=` + apptId)
                const date = new Date(reqDateTimeUrl.data.requestedDatetime);
                const singaporeTime = new Date(date.getTime() - 8 * 60 * 60 * 1000);
                setDateTime(singaporeTime);
                setReason(reqDateTimeUrl.data.reason);
            } catch (error) {
                console.error("Error fetching requested date time: ", error);
            }
        }

        fetchAirconData();
        fetchAppointmentData();
        fetchReqDateTime();
    }, []);

    const handleApprove = async (e) => {
        e.preventDefault();
        setError('');

        const singaporeDateTime = new Date(dateTime.getTime() + 8 * 60 * 60 * 1000);
        const formattedDate = `${singaporeDateTime.toISOString().slice(0, 19).replace('T', ' ')}`;

        try {
            const updateDateTime = await api.patch(`/api/appointments/` + apptId + '/', {
                dateTime: formattedDate
            });

            const updateStatus = await api.patch(`/api/rescheduleappointment/` + apptId + '/', {
                status: "Approved",
                reason: reason
            });
            navigate('/CoordinatorHome')
        } catch (error) {
            console.error('Error updating date time and status of rescheduled appointment:', error.response);
            setError('Error approving rescheduling of appointment. Please try again.');
        }
    }

    const handleReject = async (e) => {
        e.preventDefault();
        setError('');

        try {
            await api.patch(`/api/rescheduleappointment/` + apptId + '/', {
                status: "Denied",
                reason: reason
            });
            navigate('/CoordinatorHome');
        } catch (error) {
            console.error('Error updating status of rescheduled appointment:', error.response);
            setError('Error rejecting rescheduling of appointment. Please try again.');
        }
    }

    return (
        <div className="w-full h-full bg-gray-100">
            <div className="flex p-5 items-center justify-center">
                <div className="p-6 m-40 bg-white rounded-xl shadow-md w-2/6">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Appointment Details</h2>
                    <form>

                        {/* The technician name section */}
                        <div className="mb-4 flex w-full content-beween">
                            <div className="w-3/6 mr-2">
                                <label className="block mb-2 text-sm font-bold text-gray-700">
                                    Customer:
                                </label>
                                <input 
                                    type="text"
                                    value={customerData.customerName}
                                    className="w-full p-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    disabled
                                />
                            </div>

                            <div className="w-3/6">
                                <label className='block mb-2 text-sm font-bold text-gray-700'>
                                    Technician:
                                </label>
                                <input 
                                    type="text" 
                                    value={technicianData.technicianName}
                                    className="w-full p-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Technician Name" 
                                    disabled
                                />
                            </div>
                        </div>

                        {/* The appointment status and datetime section */}
                        <div className="mb-4 flex w-full content-between">
                            <div className="w-4/6 mr-2">
                                <label className='block mb-2 text-sm font-bold text-gray-700'>
                                    Appointment Status:
                                </label>
                                <input type="text" 
                                    value={apptStatus}
                                    id="helper-text" 
                                    aria-describedby="helper-text-explanation"
                                    className="w-full p-2 leading-tight text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    disabled
                                /> 
                            </div>
                            <div className="w-2/6">
                                <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="date-time">
                                    Date/Time
                                </label>
                                <DatePicker
                                    id="date-time"
                                    selected={dateTime}
                                    onChange={(date) => setDateTime(date)}
                                    showTimeSelect
                                    timeFormat="HH:mm"
                                    timeIntervals={30}
                                    timeCaption="time"
                                    dateFormat="MMM d, yyyy h:mm aa"
                                    className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    disabled
                                />
                            </div>
                        </div>

                        {/* The selected aircon section */}
                        <fieldset className="mb-4">
                            <legend className="block mb-2 text-sm font-bold text-gray-700">Select Aircons</legend>
                            {airconData.map((aircon) => (
                                <div key={aircon.id} className="mb-2 text-gray-900 text-sm">
                                    <input
                                        type="checkbox"
                                        id={aircon.airconName}
                                        value={aircon.airconName}
                                        checked={selectedAircons.includes(aircon.id)}
                                        className="mr-2"
                                        disabled
                                    />
                                    <label htmlFor={aircon.airconName} className="text-sm text-gray-700">{aircon.airconName}</label>
                                </div>
                            ))}
                        </fieldset>

                        {/* The feedback section */}
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="feedback">
                                Reason
                            </label>
                            <textarea
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="reason"
                                type="text"
                                placeholder="Reason"
                                value={reason}
                                disabled
                            />
                        </div>

                        {/* The remark section */}
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="feedback">
                                Remark
                            </label>
                            <textarea
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="remark"
                                type="text"
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                                placeholder="Remark on approval/rejection"
                            />
                        </div>
                        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

                        {/* The buttons section */}
                        <div className="flex items-center justify-center content-between">
                            <button
                                className="px-4 py-2 mr-5 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                type="button"
                                onClick={handleApprove}
                            >
                                Approve    
                            </button>

                            <button
                                className="px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-700 focus:outline-none focus:shadow-outline"
                                type="button"
                                onClick={handleReject}
                            >
                                Reject    
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default RescheduleCoordinator;