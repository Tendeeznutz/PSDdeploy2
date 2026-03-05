import React, {useState, useEffect} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import api from "../axiosConfig";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';


function TechnicianProfile() {

    const navigate = useNavigate();

    // Helper function to display travel type in a readable format
    const displayTravelType = (travelType) => {
        if (!travelType) return 'Not Set';
        const travelTypes = {
            'own_vehicle': 'Own Vehicle',
            'rented_vehicle': 'Rented Vehicle',
            'company_vehicle': 'Company Vehicle',
        };
        return travelTypes[travelType] || travelType;
    };

    // Valid travel type values
    const VALID_TRAVEL_TYPES = ['own_vehicle', 'rented_vehicle', 'company_vehicle'];

    const [techniciandetails, setTechniciandetails] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const AC_BRANDS = ['Daikin', 'Mitsubishi', 'Panasonic', 'LG', 'Samsung', 'Fujitsu', 'Sharp', 'Toshiba', 'Hitachi', 'York', 'Other'];
    const [editedDetails, setEditedDetails] = useState({
        technicianName: '',
        technicianPhone: '',
        technicianEmail: '',
        technicianAddress: '',
        technicianPostalCode: '',
        technicianTravelType: '',
        specializations: [],
        technicianPassword: '',
        technicianPasswordConfirm: ''
    });
    const [errorMessage, setErrorMessage] = useState('');




    useEffect(() => {
        api.get(`/api/technicians/?technicianId=` + localStorage.getItem("technicians_id"))
            .then(response => {
                const data = response.data[0];
                setTechniciandetails(data);
                // Sanitize travel type - if old/invalid value, set to null
                const loadedTravelType = VALID_TRAVEL_TYPES.includes(data.technicianTravelType)
                    ? data.technicianTravelType
                    : null;
                setEditedDetails({
                    technicianName: data.technicianName,
                    technicianPhone: data.technicianPhone,
                    technicianEmail: data.technicianEmail || '',
                    technicianAddress: data.technicianAddress,
                    technicianPostalCode: data.technicianPostalCode,
                    technicianTravelType: loadedTravelType,
                    specializations: data.specializations || [],
                    technicianPassword: '',
                    technicianPasswordConfirm: ''
                });
            })
            .catch(error => {
                console.error('There was an error!', error);
            });
    }, []);

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
        setErrorMessage('');
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            // Singapore phone number validation (8 digits, optional starting with 6, 8, or 9)
            const phoneRegex = /^(6|8|9)\d{7}$/;
            if (!phoneRegex.test(editedDetails.technicianPhone)) {
                throw new Error("Please enter a valid Singapore phone number.");
            }

            // Email validation (if provided)
            if (editedDetails.technicianEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(editedDetails.technicianEmail)) {
                    throw new Error("Please enter a valid email address.");
                }
            }

            // Check if password fields match if password is being changed
            if (editedDetails.technicianPassword || editedDetails.technicianPasswordConfirm) {
                if (editedDetails.technicianPassword !== editedDetails.technicianPasswordConfirm) {
                    throw new Error("Passwords do not match.");
                }
                if (editedDetails.technicianPassword.length < 6) {
                    throw new Error("Password must be at least 6 characters long.");
                }
            }

            const payload = {
                technicianName: editedDetails.technicianName,
                technicianPhone: editedDetails.technicianPhone,
                technicianEmail: editedDetails.technicianEmail || null,
                technicianAddress: editedDetails.technicianAddress,
                technicianPostalCode: editedDetails.technicianPostalCode,
                technicianTravelType: editedDetails.technicianTravelType || null,
                specializations: editedDetails.specializations || [],
            };

            // Only include password if it's been entered
            if (editedDetails.technicianPassword) {
                payload.technicianPassword = editedDetails.technicianPassword;
            }

            const response = await api.patch(
                `/api/technicians/${techniciandetails.id}/`,
                payload
            );

            if (response.status === 200) {
                setTechniciandetails(response.data);
                setIsEditing(false);
                setEditedDetails({...editedDetails, technicianPassword: '', technicianPasswordConfirm: ''});
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            if (error.response?.data) {
                // Show specific field validation errors from backend
                const errors = error.response.data;
                const errorMessages = Object.entries(errors)
                    .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                    .join('; ');
                setErrorMessage(errorMessages || `Request failed with status code ${error.response.status}`);
            } else if (error.message) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage('Failed to update profile. Please try again.');
            }
        }
    };

    return (
        <div className="container mx-auto p-4">
            {/* Profile Section */}
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="p-20 bg-white rounded shadow-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Your Profile</h2>
                    {/* Display User Details */}
                    {!isEditing ? (
                        <div>
                            <div className="mb-4">
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Name: {techniciandetails.technicianName}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Phone: {techniciandetails.technicianPhone}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Email: {techniciandetails.technicianEmail || <span className="text-gray-400 font-normal">(Not set)</span>}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Address: {techniciandetails.technicianAddress}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Travel Type: {displayTravelType(techniciandetails.technicianTravelType)}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Specializations:{' '}
                                    {techniciandetails.specializations && techniciandetails.specializations.length > 0
                                        ? techniciandetails.specializations.join(', ')
                                        : <span className="text-gray-400 font-normal">None set</span>}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Status: {techniciandetails.technicianStatus === "1" ? "Available" : "Unavailable"}
                                </label>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                    type="button"
                                    onClick={handleEditToggle}
                                >
                                    Edit Profile
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSaveProfile}>
                            <div className="mb-4">
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Name</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.technicianName}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianName: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Phone</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.technicianPhone}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianPhone: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Email (for notifications)</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="email"
                                        value={editedDetails.technicianEmail}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianEmail: e.target.value})}
                                        placeholder="Enter your email for appointment notifications"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Address</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.technicianAddress}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianAddress: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Postal Code</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="text"
                                        value={editedDetails.technicianPostalCode}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianPostalCode: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Travel Type</label>
                                    <select
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        value={editedDetails.technicianTravelType || ''}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianTravelType: e.target.value || null})}
                                    >
                                        <option value="">-- Select Travel Type --</option>
                                        <option value="own_vehicle">Own Vehicle</option>
                                        <option value="rented_vehicle">Rented Vehicle</option>
                                        <option value="company_vehicle">Company Vehicle</option>
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">AC Brand Specializations</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-300">
                                        {AC_BRANDS.map(brand => (
                                            <label key={brand} className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(editedDetails.specializations || []).includes(brand)}
                                                    onChange={(e) => {
                                                        const current = editedDetails.specializations || [];
                                                        const updated = e.target.checked
                                                            ? [...current, brand]
                                                            : current.filter(b => b !== brand);
                                                        setEditedDetails({...editedDetails, specializations: updated});
                                                    }}
                                                />
                                                {brand}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">New Password (leave blank to keep current)</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="password"
                                        value={editedDetails.technicianPassword}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianPassword: e.target.value})}
                                        placeholder="Enter new password"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-bold text-gray-700">Confirm New Password</label>
                                    <input
                                        className="w-full p-2 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                        type="password"
                                        value={editedDetails.technicianPasswordConfirm}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianPasswordConfirm: e.target.value})}
                                        placeholder="Confirm new password"
                                    />
                                </div>
                            </div>

                            {errorMessage && <div className="mb-4 text-sm text-red-500">{errorMessage}</div>}

                            <div className="flex items-center justify-center gap-2">
                                <button
                                    className="px-4 py-2 font-bold text-white bg-green-500 rounded hover:bg-green-700 focus:outline-none focus:shadow-outline"
                                    type="submit"
                                >
                                    Save Changes
                                </button>
                                <button
                                    className="px-4 py-2 font-bold text-white bg-gray-500 rounded hover:bg-gray-700 focus:outline-none focus:shadow-outline"
                                    type="button"
                                    onClick={handleEditToggle}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TechnicianProfile;
