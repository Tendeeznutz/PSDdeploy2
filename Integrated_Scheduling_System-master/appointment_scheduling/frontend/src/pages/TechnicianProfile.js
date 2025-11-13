import React, {useState, useEffect} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';


function TechnicianProfile() {

    const navigate = useNavigate();
    const [techniciandetails, setTechniciandetails] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editedDetails, setEditedDetails] = useState({
        technicianName: '',
        technicianPhone: '',
        technicianAddress: '',
        technicianPostalCode: '',
        technicianTravelType: '',
        technicianPassword: '',
        technicianPasswordConfirm: ''
    });
    const [errorMessage, setErrorMessage] = useState('');




    useEffect(() => {
        axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technicians/?technicianId=` + localStorage.getItem("technicians_id"))
            .then(response => {
                setTechniciandetails(response.data[0]);
                setEditedDetails({
                    technicianName: response.data[0].technicianName,
                    technicianPhone: response.data[0].technicianPhone,
                    technicianAddress: response.data[0].technicianAddress,
                    technicianPostalCode: response.data[0].technicianPostalCode,
                    technicianTravelType: response.data[0].technicianTravelType,
                    technicianPassword: '',
                    technicianPasswordConfirm: ''
                });
                console.log(response.data[0]);
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
                technicianAddress: editedDetails.technicianAddress,
                technicianPostalCode: editedDetails.technicianPostalCode,
                technicianTravelType: editedDetails.technicianTravelType,
            };

            // Only include password if it's been entered
            if (editedDetails.technicianPassword) {
                payload.technicianPassword = editedDetails.technicianPassword;
            }

            const response = await axios.patch(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technicians/${techniciandetails.id}/`,
                payload
            );

            if (response.status === 200) {
                setTechniciandetails(response.data);
                setIsEditing(false);
                setEditedDetails({...editedDetails, technicianPassword: '', technicianPasswordConfirm: ''});
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            if (error.message) {
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
                                    Address: {techniciandetails.technicianAddress}
                                </label>
                                <label className="block mb-2 text-lg font-bold text-gray-700">
                                    Travel Type: {techniciandetails.technicianTravelType}
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
                                        value={editedDetails.technicianTravelType}
                                        onChange={(e) => setEditedDetails({...editedDetails, technicianTravelType: e.target.value})}
                                    >
                                        <option value="drive">Drive</option>
                                        <option value="walk">Walk</option>
                                        <option value="cycle">Cycle</option>
                                    </select>
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
