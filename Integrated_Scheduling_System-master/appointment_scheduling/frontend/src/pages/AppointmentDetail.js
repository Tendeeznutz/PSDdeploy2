import React, {useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Progress, Popconfirm, Modal, Input } from 'antd';

const { TextArea } = Input;

function AppointmentDetails() {
    const techniciansPhone = localStorage.getItem("technicians_phone");
    const hasTechniciansPhone = techniciansPhone !== null;

    const [dateTime, setDateTime] = useState('');
    const [selectedAircons, setSelectedAircons] = useState([]);
    const [airconData, setAirconData] = useState([]);
    const [feedback, setFeedback] = useState('');
    const [technicianData, setTechnicianData] = useState({});
    const [customerData, setCustomerData] = useState({});
    const [apptStatus, setApptStatus] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [cancellationReason, setCancellationReason] = useState('');
    const [existingCancellationReason, setExistingCancellationReason] = useState('');

    const [error, setError] = useState('');
    const [editState, setEditState] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const navigate = useNavigate();

    const apptId = new URLSearchParams(window.location.search).get('id');
    const fetchSelectedAppointmentData = async () => {
        try {
            const appointmentDataResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/` + apptId + `/`);
            return appointmentDataResponse.data;
        } catch (error) {
            console.error('Error fetching appointment data:', error);
        }
    }

    const fetchSelectedUserAircon = async (customerId) => {
        try {
            const userSelectedAirconResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/customeraircondevices/?customerId=${customerId}`);
            return userSelectedAirconResponse.data;
        } catch (error) {
            console.error('Error fetching user selected aircon:', error);
        }
    }

    useEffect(() => {
        fetchSelectedAppointmentData().then((appointmentData) => {
            setDateTime(new Date(appointmentData.appointmentStartTime * 1000));
            setSelectedAircons(appointmentData.airconToService);
            setFeedback(appointmentData.customerFeedback);
            setTechnicianData({
                technicianId: appointmentData.technicianId,
                technicianName: appointmentData.display.technicianName
            });
            setCustomerData({
                customerId: appointmentData.customerId,
                customerName: appointmentData.display.customerName
            });
            setApptStatus(appointmentData.display.appointmentStatus);
            setPaymentMethod(appointmentData.display.paymentMethod || '');

            // Set existing cancellation reason if appointment is cancelled
            if (appointmentData.cancellationReason) {
                setExistingCancellationReason(appointmentData.cancellationReason);
            }

            fetchSelectedUserAircon(appointmentData.customerId).then((userSelectedAirconList) => {
                setAirconData(userSelectedAirconList);
            }
            );
        });
    }, [editState]);

    const handleAirconChange = (airconName) => {
        console.log('Aircon changed:', airconName);
        setSelectedAircons(prevSelectedAircons => {
            if (prevSelectedAircons.includes(airconName)) {
                return prevSelectedAircons.filter(name => name !== airconName);
            } else {
                return [...prevSelectedAircons, airconName];
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError('');
        setShowProgress(true);

        // post data to backend
        try {
            if (!dateTime || selectedAircons.length === 0) {
                throw new Error('Please fill in all fields.');
            }

            const singaporeDateTimeUnix = dateTime.getTime() / 1000;

            const response = await axios.patch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/` + apptId + '/', {
                appointmentStartTime: singaporeDateTimeUnix,
                airconToService: selectedAircons,
                customerFeedback: feedback || null
            });

            if (response.status === 200) {
                setProgress(100);

                setTimeout(() => {
                    console.log('Appointment scheduled:', response.data);
                    navigate('/home');
                }, 1000);
            }

            // const getRescheduledAppt = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/rescheduleappointment/?Appointment=${apptId}`);
            // if (getRescheduledAppt.data.length > 0) {
            //     console.log("hi")
            //     const response = await axios.patch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/rescheduleappointment/?Appointment=${apptId}`, {
            //         requestedDateTime: singaporeDateTimeUnix,
            //         reason: "testing2",
            //         appointment: apptId
            //     });
            //     console.log('Appointment rescheduled:', response.data);
            // }
            // else {
            //     const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/rescheduleappointment/`, {
            //         requestedDateTime: singaporeDateTimeUnix,
            //         reason: "testing",
            //         appointment: apptId
            //     });
            //     console.log('Appointment rescheduled:', response.data);
            // }
        } catch (error) {
            console.error('Error scheduling appointment:', error.response);
            if (error.message === "Please fill in all fields. Please try again.") {
                setError(error.message);
            } else {
                setError("Scheduled Date cannot be past or present. Please try again.")
            }
            setShowProgress(false);
        }
    };

    const handleDelete = async (e) => {
        e.preventDefault();
        setError('');
        setShowProgress(true);

        try {
            console.log('Deleting appointment:', apptId);
            const response = await axios.delete(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/` + apptId + '/');

            if (response.status === 204) {
                setProgress(100);
                setTimeout(() => {
                    navigate('/home');
                }, 1000);
            }
        } catch (error) {
            console.error('Error deleting appointment:', error);
            setError('Error deleting appointment. Please try again.');
            setShowProgress(false);
        }
    }

    const handleCancelClick = () => {
        setShowCancelModal(true);
        setError('');
    };

    const handleCancelModalOk = async () => {
        if (!cancellationReason || cancellationReason.trim() === '') {
            setError('Please provide a reason for cancellation.');
            return;
        }

        setError('');
        setShowProgress(true);
        setShowCancelModal(false);

        try {
            console.log('Cancelling appointment:', apptId);
            const response = await axios.patch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/` + apptId + '/', {
                appointmentStatus: '4',
                cancellationReason: cancellationReason,
                cancelledBy: 'technician'
            });

            if (response.status === 200) {
                setProgress(100);
                setTimeout(() => {
                    navigate('/TechnicianHome');
                }, 1000);
            }
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            if (error.response && error.response.data && error.response.data.error) {
                setError(error.response.data.error);
            } else {
                setError('Error cancelling appointment. Please try again.');
            }
            setShowProgress(false);
        }
    };

    const handleCancelModalCancel = () => {
        setShowCancelModal(false);
        setCancellationReason('');
        setError('');
    };


    const toggleEditState = () => {
        setEditState(prevEditState => !prevEditState);
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
                                <input
                                    type="text"
                                    value={apptStatus}
                                    id="helper-text"
                                    aria-describedby="helper-text-explanation"
                                    //className={`w-full px-3 py-3 leading-tight text-gray-700 border rounded shadow appearance-none focus:outline-none focus:shadow-outline ${statusColor.find((statusObj) => statusObj.status === apptStatus).color}`}
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
                                    {...(editState ? {} : {disabled: true})}
                                />
                            </div>
                        </div>

                        {/* Payment Method - only shown to customers and coordinators */}
                        {!hasTechniciansPhone && paymentMethod && (
                            <div className="mb-4">
                                <label className='block mb-2 text-sm font-bold text-gray-700'>
                                    Payment Method:
                                </label>
                                <input
                                    type="text"
                                    value={paymentMethod}
                                    className="w-full p-2 leading-tight text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    disabled
                                />
                            </div>
                        )}

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
                                        onChange={() => handleAirconChange(aircon.id)}
                                        className="mr-2"
                                        {...(editState ? {} : {disabled: true})}
                                    />
                                    <label htmlFor={aircon.airconName} className="text-sm text-gray-700">{aircon.airconName}</label>
                                </div>
                            ))}
                        </fieldset>

                        {/* The feedback section */}
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="feedback">
                                Feedback
                            </label>
                            <textarea
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="feedback"
                                type="text"
                                placeholder="No Feedback"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                {...(editState ? {} : {disabled: true})}
                            />
                        </div>

                        {/* Display cancellation reason if appointment is cancelled */}
                        {existingCancellationReason && (
                            <div className="mb-4">
                                <label className="block mb-2 text-sm font-bold text-gray-700">
                                    Cancellation Reason
                                </label>
                                <div className="w-full p-2 leading-tight text-sm text-gray-700 bg-red-50 rounded-lg border border-red-300">
                                    {existingCancellationReason}
                                </div>
                            </div>
                        )}

                        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

                        {/* The buttons section */}
                        {editState && (
                            <div className="flex items-center justify-between content-between">
                                <button
                                    className="px-4 py-2 font-bold text-white bg-black rounded-md hover:bg-stone-700 focus:outline-none focus:shadow-outline"
                                    type="button"
                                    onClick={toggleEditState}
                                >
                                    Cancel
                                </button>
                                {hasTechniciansPhone && apptStatus !== 'Pending' && apptStatus !== "Completed" && apptStatus !== "Cancelled" ? (
                                    <button
                                        className="px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-700 focus:outline-none focus:shadow-outline"
                                        type="button"
                                        onClick={handleCancelClick}
                                    >
                                        Cancel Appointment
                                    </button>
                                ) : (
                                    <Popconfirm
                                        title={`Update appointment?`}
                                        description="This action cannot be undone."
                                        okButtonProps={{danger: 'true'}}
                                        onConfirm={handleSubmit}
                                    >
                                        <button
                                            className="px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                            type="button"
                                        >
                                            Update Appointment
                                        </button>
                                    </Popconfirm>
                                )}
                            </div>
                        )}
                        {!editState && (
                            <div className="flex items-center justify-center content-between">
                                {!hasTechniciansPhone && (
                                    <button
                                        className="px-4 py-2 mr-5 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                        type="button"
                                        onClick={toggleEditState}
                                    >
                                        Edit Appointment
                                    </button>
                                )}

                                {hasTechniciansPhone && apptStatus !== "Pending" && apptStatus !== "Completed" && apptStatus !== "Cancelled" && (
                                    <button
                                        className="px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-700 focus:outline-none focus:shadow-outline"
                                        type="button"
                                        onClick={handleCancelClick}
                                    >
                                        Cancel Appointment
                                    </button>
                                )}

                                {!hasTechniciansPhone && (
                                    <Popconfirm
                                        title={`Delete appointment?`}
                                        description="This action cannot be undone."
                                        okButtonProps={{danger: 'true'}}
                                        onConfirm={handleDelete}
                                    >
                                        <button
                                            className="px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-700 focus:outline-none focus:shadow-outline"
                                            type="button"
                                        >
                                        Delete Appointment
                                        </button>
                                    </Popconfirm>
                                    
                                )}
                            </div>
                        )}

                    </form>
                    {showProgress && <Progress className="mt-3" percent={progress} type="line" />}
                </div>
            </div>

            {/* Cancellation Modal */}
            <Modal
                title="Cancel Appointment"
                open={showCancelModal}
                onOk={handleCancelModalOk}
                onCancel={handleCancelModalCancel}
                okText="Confirm Cancellation"
                okButtonProps={{ danger: true }}
            >
                <div className="mb-4">
                    <label className="block mb-2 text-sm font-bold text-gray-700">
                        Please provide a reason for cancellation:
                    </label>
                    <TextArea
                        rows={4}
                        placeholder="Enter cancellation reason (required)"
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        maxLength={500}
                    />
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
            </Modal>
        </div>
    );
}

export default AppointmentDetails;
