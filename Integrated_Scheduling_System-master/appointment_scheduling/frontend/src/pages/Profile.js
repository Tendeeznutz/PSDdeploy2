import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../axiosConfig";
import { Button, Popconfirm, Progress, DatePicker } from 'antd';
import dayjs from 'dayjs';

function Profile() {
    const navigate = useNavigate();
    const customer_id = localStorage.getItem('customers_id');
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    // to toggle the "add aicon" form modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    // to toggle the "edit aircon" form modal
    const [isEditAirconModalOpen, setIsEditAirconModalOpen] = useState(false);
    const [editingAircon, setEditingAircon] = useState(null);
    const [editAirconError, setEditAirconError] = useState('');
    const [progress, setProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const [userObject, setUserObject] = useState({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        customerPostalCode: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editedDetails, setEditedDetails] = useState({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        customerPostalCode: '',
        customerPassword: '',
        customerPasswordConfirm: ''
    });
    const [editErrorMessage, setEditErrorMessage] = useState('');
    const [userAirconList, setUserAirconList] = useState([]);
    // for the add aircon form submission
    const [airconName, setAirconName] = useState('');
    const [numberOfUnits, setNumberOfUnits] = useState(1);
    const [airconType, setAirconType] = useState('split');
    const [lastServiceMonth, setLastServiceMonth] = useState(null);
    const [remarks, setRemarks] = useState('');

    const fetchUserData = async () => {
        try {
            if (!customer_id) {
                console.error('No customer ID found in localStorage');
                return;
            }
            const userDataResponse = await api.get(`/api/customers/${customer_id}/`);
            return userDataResponse.data;
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    const fetchUserAirconData = async () => {
        try {
            const userAirconResponse = await api.get(`/api/customeraircondevices/?customerId=${customer_id}`);
            return userAirconResponse.data;
        } catch (error) {
            console.error('Error fetching user aircon data:', error)
        }
    }

    /* if modal is toggled close, form inputs should be cleared */
    const toggleModal = () => {
        setIsModalOpen(!isModalOpen);
        if (isModalOpen) {
            setAirconName("");
            setNumberOfUnits(1);
            setAirconType('split');
            setLastServiceMonth(null);
            setRemarks("");
            setModalError("");
        }
    };

    const handleDeleteAircon = (airconId) => async () => {
        setError('');
        try {
            const existingAppointmentResponse = await api.get(`/api/appointments/?customerId=${customer_id}`);

            if (existingAppointmentResponse.status === 200) {
                // Only block deletion if there are active (non-cancelled) appointments
                // Status: 1=Pending, 2=Confirmed, 3=Completed, 4=Cancelled
                const hasActiveAppointments = existingAppointmentResponse.data.some(existingAppointment => {
                    const isLinkedToAircon = existingAppointment.airconToService.includes(airconId);
                    const isCancelled = existingAppointment.appointmentStatus === '4';
                    return isLinkedToAircon && !isCancelled;
                });

                if (hasActiveAppointments) {
                    throw new Error('Cannot remove aircon with active appointments. Cancel or complete the appointments first.');
                }

                const response = await api.delete(`/api/customeraircondevices/${airconId}/`);
                if (response.status === 204) {
                    setUserAirconList(userAirconList.filter(aircon => aircon.id !== airconId));
                }
            }
        } catch (error) {
            console.error('Error deleting aircon:', error);
            setError(error.message);
        }
    };

    // Open edit aircon modal
    const handleEditAircon = (aircon) => {
        setEditingAircon({
            id: aircon.id,
            airconName: aircon.airconName || '',
            numberOfUnits: aircon.numberOfUnits || 1,
            airconType: aircon.airconType || 'split',
            lastServiceMonth: aircon.lastServiceMonth ? dayjs(aircon.lastServiceMonth, 'YYYY-MM') : null,
            remarks: aircon.remarks || ''
        });
        setEditAirconError('');
        setIsEditAirconModalOpen(true);
    };

    // Close edit aircon modal
    const closeEditAirconModal = () => {
        setIsEditAirconModalOpen(false);
        setEditingAircon(null);
        setEditAirconError('');
    };

    // Handle edit aircon form submission
    const handleEditAirconSubmit = async (event) => {
        event.preventDefault();
        setEditAirconError('');

        try {
            if (!editingAircon.airconType) {
                throw new Error('Please select aircon type.');
            }

            if (editingAircon.numberOfUnits < 1 || editingAircon.numberOfUnits > 100) {
                throw new Error('Number of units must be between 1 and 100.');
            }

            const payload = {
                airconName: editingAircon.airconName || null,
                numberOfUnits: editingAircon.numberOfUnits,
                airconType: editingAircon.airconType,
                lastServiceMonth: editingAircon.lastServiceMonth ? editingAircon.lastServiceMonth.format('YYYY-MM') : null,
                remarks: editingAircon.remarks || null
            };

            const response = await api.patch(
                `/api/customeraircondevices/${editingAircon.id}/`,
                payload
            );

            if (response.status === 200) {
                // Update the aircon list with the edited aircon
                setUserAirconList(userAirconList.map(aircon =>
                    aircon.id === editingAircon.id ? response.data : aircon
                ));
                closeEditAirconModal();
            }
        } catch (error) {
            console.error('Error editing aircon:', error);
            if (error.message.includes('Number of units') || error.message.includes('aircon type')) {
                setEditAirconError(error.message);
            } else if (error.response?.data?.airconName) {
                const nameError = Array.isArray(error.response.data.airconName)
                    ? error.response.data.airconName[0]
                    : error.response.data.airconName;
                setEditAirconError(nameError || "This aircon name is already in use.");
            } else if (error.response?.status === 500) {
                setEditAirconError("An error occurred at the server. Please try again.");
            } else {
                setEditAirconError(error.response?.data?.detail || "An error occurred. Please try again.");
            }
        }
    };

    /* handle the aircon form modal submission */
    const handleSubmit = async (event) => {
        setModalError('');
        setShowProgress(true);
        event.preventDefault();

        try {
            if (!airconType) {
                setShowProgress(false);
                throw new Error('Please select aircon type.');
            }

            if (numberOfUnits < 1 || numberOfUnits > 100) {
                setShowProgress(false);
                throw new Error('Number of units must be between 1 and 100.');
            }

            let payload = {
                airconName: airconName ? airconName : null,
                customerId: customer_id,
                numberOfUnits: numberOfUnits,
                airconType: airconType,
                lastServiceMonth: lastServiceMonth ? lastServiceMonth.format('YYYY-MM') : null,
                remarks: remarks || null
            };

            const response = await api.post(`/api/customeraircondevices/`, payload);
            if (response.status === 201) {
                setProgress(100);
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }

        }
        catch (error) {
            console.error('Error adding aircon:', error);
            if (error.message.includes('Number of units') || error.message.includes('aircon type')) {
                setModalError(error.message);
            } else if (error.response?.data?.airconName) {
                // Handle duplicate aircon name error
                const nameError = Array.isArray(error.response.data.airconName)
                    ? error.response.data.airconName[0]
                    : error.response.data.airconName;
                setModalError(nameError || "This aircon name is already in use.");
            } else if (error.response?.data?.lastServiceMonth) {
                setModalError(error.response.data.lastServiceMonth[0] || "Invalid service month format.");
            } else if (error.response?.data?.numberOfUnits) {
                setModalError(error.response.data.numberOfUnits[0] || "Invalid number of units.");
            } else if (error.response?.status === 500) {
                setModalError("An error have occured at the server. Please try again.");
            } else {
                setModalError(error.response?.data?.detail || "An error occurred. Please try again.");
            }
            setShowProgress(false);
        }
    };

    const handleEditToggle = () => {
        if (!isEditing) {
            // Entering edit mode - populate edited details
            setEditedDetails({
                customerName: userObject.customerName,
                customerEmail: userObject.customerEmail,
                customerPhone: userObject.customerPhone.replace('+65 ', ''),
                customerAddress: userObject.customerAddress,
                customerPostalCode: userObject.customerPostalCode.replace('S', ''),
                customerPassword: '',
                customerPasswordConfirm: ''
            });
        }
        setIsEditing(!isEditing);
        setEditErrorMessage('');
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setEditErrorMessage('');

        try {
            // Singapore phone number validation (8 digits, starting with 6, 8, or 9)
            const phoneRegex = /^(6|8|9)\d{7}$/;
            if (!phoneRegex.test(editedDetails.customerPhone)) {
                throw new Error("Please enter a valid Singapore phone number.");
            }

            // Check if password fields match if password is being changed
            if (editedDetails.customerPassword || editedDetails.customerPasswordConfirm) {
                if (editedDetails.customerPassword !== editedDetails.customerPasswordConfirm) {
                    throw new Error("Passwords do not match.");
                }
                if (editedDetails.customerPassword.length < 6) {
                    throw new Error("Password must be at least 6 characters long.");
                }
            }

            const payload = {
                customerName: editedDetails.customerName,
                customerEmail: editedDetails.customerEmail,
                customerPhone: editedDetails.customerPhone,
                customerAddress: editedDetails.customerAddress,
                customerPostalCode: editedDetails.customerPostalCode,
            };

            // Only include password if it's been entered
            if (editedDetails.customerPassword) {
                payload.customerPassword = editedDetails.customerPassword;
            }

            const response = await api.patch(
                `/api/customers/${customer_id}/`,
                payload
            );

            if (response.status === 200) {
                setUserObject({
                    customerName: response.data.customerName,
                    customerEmail: response.data.customerEmail,
                    customerPhone: '+65 ' + response.data.customerPhone,
                    customerAddress: response.data.customerAddress,
                    customerPostalCode: 'S' + response.data.customerPostalCode
                });
                setIsEditing(false);
                setEditedDetails({...editedDetails, customerPassword: '', customerPasswordConfirm: ''});
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            if (error.message) {
                setEditErrorMessage(error.message);
            } else {
                setEditErrorMessage('Failed to update profile. Please try again.');
            }
        }
    };

    useEffect(() => {
        if (!customer_id) {
            navigate('/error');
        } else {
            fetchUserData().then(data => {
                setUserObject({
                    customerName: data.customerName,
                    customerEmail: data.customerEmail,
                    customerPhone: '+65 ' + data.customerPhone,
                    customerAddress: data.customerAddress,
                    customerPostalCode: 'S' + data.customerPostalCode
                });
                setEditedDetails({
                    customerName: data.customerName,
                    customerEmail: data.customerEmail,
                    customerPhone: data.customerPhone,
                    customerAddress: data.customerAddress,
                    customerPostalCode: data.customerPostalCode,
                    customerPassword: '',
                    customerPasswordConfirm: ''
                });
            });

            fetchUserAirconData().then(userAircondata => setUserAirconList(userAircondata));
        }
    }, []);

    return (
        <div className="container mx-auto p-4">

            {/* Profile Section */}
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="p-20 bg-white rounded shadow-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Your Profile</h2>
                    <form onSubmit={handleSaveProfile}>
                        {/* Display User Details */}
                        {!isEditing ? (
                            <div className="mb-4 w-full">
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Name: {userObject.customerName}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Email: {userObject.customerEmail}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Phone: {userObject.customerPhone}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Address: {userObject.customerAddress} {userObject.customerPostalCode}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Aircon:
                                </label>
                            {/* List of Aircons */}
                            {
                                userAirconList.length === 0
                                    ?   null
                                    :   userAirconList.map((aircon) => (
                                        <div key={aircon.id} className="mb-2 flex items-center justify-between text-sm">
                                            <div className="flex-1">
                                                <label className="text-gray-700 font-medium">{aircon.airconName}</label>
                                                <span className="text-gray-500 text-xs ml-2">
                                                    ({aircon.numberOfUnits} unit{aircon.numberOfUnits > 1 ? 's' : ''} - {aircon.airconType})
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    onClick={() => handleEditAircon(aircon)}
                                                >
                                                    Edit
                                                </Button>
                                                <Popconfirm
                                                    title={`Remove ${aircon.airconName}?`}
                                                    description="This action cannot be undone."
                                                    okButtonProps={{danger: 'true'}}
                                                    onConfirm={handleDeleteAircon(aircon.id)}
                                                >
                                                    <Button danger size="small">Remove</Button>
                                                </Popconfirm>
                                            </div>
                                        </div>
                                    ))
                            }
                            {/* Button to show aircon form modal */}
                            <button
                                type="button"
                                onClick={toggleModal}
                                className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 border border-blue-700 rounded text-xs mb-2"
                                data-ripple-light="true"
                                data-dialog-target="animated-dialog"
                            >
                                Add Aircon
                            </button>
                            {/* Edit Profile Button */}
                            <button
                                type="button"
                                onClick={handleEditToggle}
                                className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 border border-green-700 rounded text-xs"
                            >
                                Edit Profile
                            </button>
                            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
                        </div>
                        ) : (
                            <div className="mb-4 w-full">
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Name</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.customerName}
                                        onChange={(e) => setEditedDetails({...editedDetails, customerName: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Email</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="email"
                                        value={editedDetails.customerEmail}
                                        onChange={(e) => setEditedDetails({...editedDetails, customerEmail: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Phone</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.customerPhone}
                                        onChange={(e) => setEditedDetails({...editedDetails, customerPhone: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Address</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.customerAddress}
                                        onChange={(e) => setEditedDetails({...editedDetails, customerAddress: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Postal Code</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.customerPostalCode}
                                        onChange={(e) => setEditedDetails({...editedDetails, customerPostalCode: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">New Password (leave blank to keep current)</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="password"
                                        value={editedDetails.customerPassword}
                                        onChange={(e) => setEditedDetails({...editedDetails, customerPassword: e.target.value})}
                                        placeholder="Enter new password"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Confirm New Password</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="password"
                                        value={editedDetails.customerPasswordConfirm}
                                        onChange={(e) => setEditedDetails({...editedDetails, customerPasswordConfirm: e.target.value})}
                                        placeholder="Confirm new password"
                                    />
                                </div>
                                {editErrorMessage && <div className="mb-4 text-sm text-red-500">{editErrorMessage}</div>}
                                <div className="flex gap-2">
                                    <button
                                        className="flex-1 px-4 py-2 font-bold text-white bg-green-500 rounded hover:bg-green-700 focus:outline-none focus:shadow-outline"
                                        type="submit"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        className="flex-1 px-4 py-2 font-bold text-white bg-gray-500 rounded hover:bg-gray-700 focus:outline-none focus:shadow-outline"
                                        type="button"
                                        onClick={handleEditToggle}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Modal for Adding Aircon */}
                {isModalOpen && (
                    <div id="my-portal" className="fixed z-10 inset-0 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                            </div>

                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="w-full mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                            <form onSubmit={handleSubmit}>
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Add Aircon
                                                    <span className="block italic text-sm text-stone-400">Fill in your aircon details</span>
                                                </h3>
                                                <hr className="m-3 w-full" />
                                                <div className="mt-2">
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Number of Units <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={numberOfUnits}
                                                            onChange={(e) => setNumberOfUnits(parseInt(e.target.value) || 1)}
                                                            min="1"
                                                            max="100"
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Aircon Type <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            onChange={(e) => setAirconType(e.target.value)}
                                                            value={airconType}
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                            required
                                                        >
                                                            <option value="split">Split</option>
                                                            <option value="window">Window</option>
                                                            <option value="centralized">Centralized</option>
                                                            <option value="floor_mounted">Floor Mounted</option>
                                                            <option value="portable">Portable</option>
                                                            <option value="industrial">Industrial</option>
                                                        </select>
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Aircon Name (optional)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={airconName}
                                                            onChange={(e) => setAirconName(e.target.value)}
                                                            placeholder="e.g., Living Room AC"
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                        <span className="text-xs text-gray-500">Leave blank for auto-generated name</span>
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Last Service Month (optional)
                                                        </label>
                                                        <DatePicker
                                                            picker="month"
                                                            value={lastServiceMonth}
                                                            onChange={(date) => setLastServiceMonth(date)}
                                                            disabledDate={(current) => current && current > dayjs().endOf('month')}
                                                            format="MMMM YYYY"
                                                            placeholder="Select service month (YYYY-MM)"
                                                            className="w-full p-2 text-sm"
                                                            style={{ width: '100%' }}
                                                        />
                                                        <span className="text-xs text-gray-500">Click to select month and year from calendar</span>
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Remarks (optional)
                                                        </label>
                                                        <textarea
                                                            value={remarks}
                                                            onChange={(e) => setRemarks(e.target.value)}
                                                            placeholder="Any additional information about this aircon..."
                                                            rows="3"
                                                            maxLength="500"
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                        <span className="text-xs text-gray-500">{remarks.length}/500 characters</span>
                                                    </div>
                                                    {modalError && <p className="mb-4 text-sm text-red-600">{modalError}</p>}
                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                                            type="submit"
                                                        >
                                                            Add Aircon
                                                        </button>
                                                    </div>
                                                    {showProgress && <Progress className="mt-3" percent={progress} type="line" />}

                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={toggleModal}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal for Editing Aircon */}
                {isEditAirconModalOpen && editingAircon && (
                    <div id="edit-aircon-portal" className="fixed z-10 inset-0 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                            </div>

                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="w-full mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                            <form onSubmit={handleEditAirconSubmit}>
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Edit Aircon
                                                    <span className="block italic text-sm text-stone-400">Update your aircon details</span>
                                                </h3>
                                                <hr className="m-3 w-full" />
                                                <div className="mt-2">
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Number of Units <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={editingAircon.numberOfUnits}
                                                            onChange={(e) => setEditingAircon({...editingAircon, numberOfUnits: parseInt(e.target.value) || 1})}
                                                            min="1"
                                                            max="100"
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Aircon Type <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            onChange={(e) => setEditingAircon({...editingAircon, airconType: e.target.value})}
                                                            value={editingAircon.airconType}
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                            required
                                                        >
                                                            <option value="split">Split</option>
                                                            <option value="window">Window</option>
                                                            <option value="centralized">Centralized</option>
                                                            <option value="floor_mounted">Floor Mounted</option>
                                                            <option value="portable">Portable</option>
                                                            <option value="industrial">Industrial</option>
                                                        </select>
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Aircon Name (optional)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={editingAircon.airconName}
                                                            onChange={(e) => setEditingAircon({...editingAircon, airconName: e.target.value})}
                                                            placeholder="e.g., Living Room AC"
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Last Service Month (optional)
                                                        </label>
                                                        <DatePicker
                                                            picker="month"
                                                            value={editingAircon.lastServiceMonth}
                                                            onChange={(date) => setEditingAircon({...editingAircon, lastServiceMonth: date})}
                                                            disabledDate={(current) => current && current > dayjs().endOf('month')}
                                                            format="MMMM YYYY"
                                                            placeholder="Select service month (YYYY-MM)"
                                                            className="w-full p-2 text-sm"
                                                            style={{ width: '100%' }}
                                                        />
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block mb-2 text-sm font-bold text-gray-700">
                                                            Remarks (optional)
                                                        </label>
                                                        <textarea
                                                            value={editingAircon.remarks}
                                                            onChange={(e) => setEditingAircon({...editingAircon, remarks: e.target.value})}
                                                            placeholder="Any additional information about this aircon..."
                                                            rows="3"
                                                            maxLength="500"
                                                            className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                        <span className="text-xs text-gray-500">{editingAircon.remarks.length}/500 characters</span>
                                                    </div>
                                                    {editAirconError && <p className="mb-4 text-sm text-red-600">{editAirconError}</p>}
                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            className="px-4 py-2 font-bold text-white bg-green-500 rounded hover:bg-green-700 focus:outline-none focus:shadow-outline"
                                                            type="submit"
                                                        >
                                                            Save Changes
                                                        </button>
                                                    </div>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={closeEditAirconModal}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

};

export default Profile;
