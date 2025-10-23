import React, {useState, useEffect} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';


function TechnicianProfile() {


    const [techniciandetails, setTechniciandetails] = useState([]);




    useEffect(() => {
        axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technicians/?technicianId=` + localStorage.getItem("technicians_id"))
            .then(response => {
                setTechniciandetails(response.data[0]);
                console.log(response.data[0]);
            })
            .catch(error => {
                console.error('There was an error!', error);
            });
    }, []);

    return (
        <div className="container mx-auto p-4">
            {/* Profile Section */}
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="p-20 bg-white rounded shadow-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Your Profile</h2>
                    <form>
                        {/* Display User Details */}
                        <div className="mb-4">
                            <label className="block mb-2 text-lg font-bold text-gray-700" htmlFor="date-time">
                                Name: {techniciandetails.technicianName}
                            </label>

                            <label className="block mb-2 text-lg font-bold text-gray-700" htmlFor="date-time">
                                Phone: {techniciandetails.technicianPhone}
                            </label>
                            <label className="block mb-2 text-lg font-bold text-gray-700" htmlFor="date-time">
                                Address: {techniciandetails.technicianAddress}
                            </label>
                            <label className="block mb-2 text-lg font-bold text-gray-700" htmlFor="date-time">
                                Travel Type: {techniciandetails.technicianTravelType}
                            </label>
                            <label className="block mb-2 text-lg font-bold text-gray-700" htmlFor="date-time">
                                Status: {techniciandetails.technicianStatus === "1" ? "Available" : "Unavailable"}
                            </label>

                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default TechnicianProfile;
