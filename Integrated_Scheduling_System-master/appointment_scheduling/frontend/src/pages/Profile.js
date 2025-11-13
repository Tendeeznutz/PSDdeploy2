import React, { useState, useEffect } from 'react';
// import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Button, Popconfirm, Progress } from 'antd';

function Profile() {
    const navigate = useNavigate();
    const customer_id = localStorage.getItem('customers_id');
    const [dateTime, setDateTime] = useState('');
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    // to toggle the "add aicon" form modal
    const [isModalOpen, setIsModalOpen] = useState(false);
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
    const [airconCatalogList, setAirCatalogList] = useState([]);
    // for the add aircon form submission
    const [airconBrandModels, setAirconBrandModels] = useState([]);
    const [selectedAirconBrand, setSelectedAirconBrand] = useState("");
    const [airconName, setAirconName] = useState('');
    const [selectedAirconID, setSelectedAirconID] = useState("");

    const fetchUserData = async () => {
        try {
            if (!customer_id) {
                console.error('No customer ID found in localStorage');
                return;
            }
            const userDataResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/customers/${customer_id}/`);
            return userDataResponse.data;
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    const fetchUserAirconData = async () => {
        try {
            const userAirconResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/customeraircondevices/?customerId=${customer_id}`);
            return userAirconResponse.data;
        } catch (error) {
            console.error('Error fetching user aircon data:', error)
        }
    }

    const fetchAirconCatalogData = async () => {
        try {
            const airCatalogResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/airconcatalogs/`);
            return airCatalogResponse.data;
        } catch (error) {
            console.error('Error fetching all aircon data:', error)
        }
    }

    /* each time aircon model selected, invoke this function; Once selected 
    aircon brand and model matches in the list of aircon catalogs retrieved, 
    set the selected aircon ID from the catalog */
    const handleAirconModelChange = event => {
        // get aircon ID
        for (let i = 0; i < airconCatalogList.length; i++) {
            if (airconCatalogList[i].airconBrand === selectedAirconBrand && airconCatalogList[i].airconModel === event.target.value) {
                setSelectedAirconID(airconCatalogList[i].id);
            }
        }
    };

    /* if modal is toggled close, form inputs should be cleared */
    const toggleModal = () => {
        setIsModalOpen(!isModalOpen);
        if (isModalOpen) {
            setSelectedAirconBrand("");
            setAirconBrandModels([]);
            setAirconName("");
            setSelectedAirconID("");
            setDateTime("");
            setModalError("");
        }
    };

    const handleDeleteAircon = (airconId) => async () => {
        setError('');
        try {
            const existingAppointmentResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?customerId=${customer_id}`);
            
            if (existingAppointmentResponse.status === 200) {
                existingAppointmentResponse.data.forEach(existingAppointment => {
                    if (existingAppointment.airconToService.includes(airconId)) {
                        throw new Error('Cannot remove aircon with existing appointments.');
                    }
                });
                const response = await axios.delete(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/customeraircondevices/${airconId}/`);
                if (response.status === 204) {
                    setUserAirconList(userAirconList.filter(aircon => aircon.id !== airconId));
                }
            }
        } catch (error) {
            console.error('Error deleting aircon:', error);
            setError(error.message);
        }
    };

    /* handle the aircon form modal submission */
    const handleSubmit = async (event) => {
        setModalError('');
        setShowProgress(true);
        event.preventDefault();
        
        try {
            if (!selectedAirconID) {
                setShowProgress(false);
                throw new Error('Please fill in aircon brand and model. Please try again.');
            }
            
            let singaporeDateTimeUnix;
            if (dateTime) {
                singaporeDateTimeUnix = dateTime.getTime() / 1000;
            }
            
            let payload = {
                airconName: airconName ? airconName : null,
                airconCatalogId: selectedAirconID,
                customerId: customer_id,
                lastServiceDate: singaporeDateTimeUnix ? singaporeDateTimeUnix : null
            };

            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/customeraircondevices/`, payload);
            if (response.status === 201) {
                setProgress(100);
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
                
        }
        catch (error) {
            console.error('Error adding aircon:', error);
            if (error.message === "Please fill in aircon brand and model.") {
                setModalError(error.message);
            } else if (error.response.data.lastServiceDate) {
                setModalError("Last service date must not be a present or future date.");
            } else if (error.status === 500) {
                setModalError("An error have occured at the server. Please try again.");
            } else {
                setModalError("An error occurred. Please try again.");
            }
            setSelectedAirconBrand("");
            setAirconBrandModels([]);
            setAirconName("");
            setDateTime("");
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

            const response = await axios.patch(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/customers/${customer_id}/`,
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

            fetchAirconCatalogData().then(data => setAirCatalogList(data));
        }


    }, []);

    /* change setAirconBrandModels everytime the selected aircon brand
    changes */
    useEffect(() => {

        let airconBrandModels = [];

        for (let i = 0; i < airconCatalogList.length; i++) {
            if (airconCatalogList[i].airconBrand === selectedAirconBrand) {
                airconBrandModels.push(airconCatalogList[i].airconModel);
            }
        }
        setAirconBrandModels(airconBrandModels);
    }, [selectedAirconBrand]);

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
                                            <label className="text-gray-700">{aircon.airconName}</label>
                                            <Popconfirm
                                                title={`Remove ${aircon.airconName}?`}
                                                description="This action cannot be undone."
                                                okButtonProps={{danger: 'true'}}
                                                onConfirm={handleDeleteAircon(aircon.id)}
                                            >
                                                <Button danger >Remove</Button>
                                            </Popconfirm>
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
                                                    Aircon form
                                                    <span className="block italic text-sm text-stone-400">Add your aircon details, select Brand first</span>
                                                </h3>
                                                <hr className="m-3 w-full" />
                                                <div className="mt-2">
                                                    <div>
                                                        <label className="mb-2 text-sm font-bold text-gray-700 mr-4">
                                                            Aircon Brand
                                                        </label>
                                                        <select
                                                            onChange={(e) => setSelectedAirconBrand(e.target.value)}
                                                            value={selectedAirconBrand}
                                                            className="p-2 mb-6 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                        >
                                                            <option key="" value="">Select Brand</option>
                                                            {
                                                                airconCatalogList.reduce((unique, aircon) => {
                                                                    if (!unique.some(item => item.airconBrand === aircon.airconBrand)) {
                                                                        unique.push(aircon);
                                                                    }
                                                                    return unique;
                                                                }, []).map((aircon) => (
                                                                    <option key={aircon.id} value={aircon.airconBrand}>{aircon.airconBrand}</option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 text-sm font-bold text-gray-700 mr-4">
                                                            Aircon Model
                                                        </label>
                                                        <select
                                                            onChange={handleAirconModelChange}
                                                            className="p-2 mb-6 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                            {...(selectedAirconBrand !== "" ? {} : {disabled: true})}
                                                        >
                                                            <option key="" value="">Select Model</option>
                                                            {airconBrandModels.length > 0 && (
                                                                airconBrandModels.map(airconModel => (
                                                                    <option key={airconModel} value={airconModel}>{airconModel}</option>
                                                                )
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 text-sm font-bold text-gray-700 mr-4">
                                                            Aircon Name
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={airconName}
                                                            onChange={(e) => setAirconName(e.target.value)}
                                                            placeholder="Aircon Name"
                                                            className="p-2 mb-6 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                            {...(selectedAirconBrand !== "" ? {} : {disabled: true})}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 text-sm font-bold text-gray-700 mr-4">
                                                            Last Service Date
                                                        </label>
                                                        <DatePicker
                                                            id="date-time"
                                                            selected={dateTime}
                                                            onChange={(date) => setDateTime(date)}
                                                            dateFormat="MMM d, yyyy"
                                                            className="w-full p-2 mb-6 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                            portalId="my-portal"
                                                            placeholderText='Select Date'
                                                            {...(selectedAirconBrand !== "" ? {} : {disabled: true})}
                                                        />
                                                    </div>
                                                    {modalError && <p className="mb-4 text-sm text-red-600">{modalError}</p>}
                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                                            type="submit"
                                                        >
                                                            Submit Aircon details
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
            </div>
        </div>
    );

};

export default Profile;
