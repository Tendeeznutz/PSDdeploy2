import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from "axios";

function RegisterTechnician() {
    const [technicianObj, setTechnicianObj] = useState({
        name: '',
        postalCode: '',
        address: '',
        phone: '',
        password: '',
        travelType: 'own_vehicle',
    });

    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage('');

        try {
            if (
                technicianObj.name === "" || 
                technicianObj.postalCode === "" || 
                technicianObj.address === "" || 
                technicianObj.phone === "" || 
                technicianObj.password === "") {
                    throw new Error("Please fill in all fields. Please try again.");
                } 
            else {
                // Singapore phone number validation (8 digits, optional starting with 6, 8, or 9)
                const phoneRegex = /^(6|8|9)\d{7}$/;
                if (!phoneRegex.test(technicianObj.phone)) {
                    throw new Error("Please enter a valid Singapore phone number. Please try again.");
                }
            } 
            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technicians/`, {
                technicianName: technicianObj.name,
                technicianPostalCode: technicianObj.postalCode,
                technicianAddress: technicianObj.address,
                technicianPhone: technicianObj.phone,
                technicianPassword: technicianObj.password,
                technicianTravelType: technicianObj.travelType,
            });

            if (response.status === 201) {
                navigate('/CoordinatorHome');
            }
        } catch (error) {
            console.log(error)
            if (error.message === "Please fill in all fields. Please try again." || error.message === "Please enter a valid Singapore phone number. Please try again.") {
                setErrorMessage(error.message);
            } else {
                setErrorMessage('Registration failed. Please try again.');
            }
        }
    };

    return (
        <div className="w-full h-full bg-gray-100">
        <div className="flex p-5 items-center justify-center">
            <div className="p-6 m-28 bg-white rounded-xl shadow-md w-2/6">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Technician Registration</h2>
                <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Name
                            </label>
                            <input
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="name"
                                type="text"
                                placeholder="Full Name"
                                value={technicianObj.name}
                                onChange={(e) => setTechnicianObj(technicianObj => ({...technicianObj, name: e.target.value}))}
                            />
                        </div>

                        <div className="mb-4 flex w-full content-between">
                            <div className="w-4/6 mr-2">
                                <label className="block mb-2 text-sm font-bold text-gray-700">
                                    Address
                                </label>
                                <input
                                    className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    id="address"
                                    type="text"
                                    placeholder="Address"
                                    value={technicianObj.address}
                                    onChange={(e) => setTechnicianObj(technicianObj => ({...technicianObj, address: e.target.value}))}
                                />
                            </div>

                            <div className="w-2/6">
                                <label className="block mb-2 text-sm font-bold text-gray-700">
                                    Postal Code
                                </label>
                                <input
                                    className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    id="postalCode"
                                    type="text"
                                    placeholder="Postal Code"
                                    value={technicianObj.postalCode}
                                    onChange={(e) => setTechnicianObj(technicianObj => ({...technicianObj, postalCode: e.target.value}))}
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Phone
                            </label>
                            <div className="flex">
                                <input
                                    className="w-12 mr-1 flex items-center justify-center p-2 leading-tight text-sm text-gray-900 bg-gray-200 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    id="countryCode"
                                    type="text"
                                    value="+65"
                                    disabled
                                />
                                <input
                                    className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    id="phone"
                                    type="text"
                                    placeholder="Phone Number"
                                    value={technicianObj.phone}
                                    onChange={(e) => setTechnicianObj(technicianObj => ({...technicianObj, phone: e.target.value}))}
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Password
                            </label>
                            <input
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="password"
                                type="password"
                                placeholder="Password"
                                value={technicianObj.password}
                                onChange={(e) => setTechnicianObj(technicianObj => ({...technicianObj, password: e.target.value}))}
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Travel Type
                            </label>
                            <select
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="travelType"
                                value={technicianObj.travelType}
                                onChange={(e) => setTechnicianObj(technicianObj => ({...technicianObj, travelType: e.target.value}))}
                            >
                                <option value="own_vehicle">Own Vehicle</option>
                                <option value="company_vehicle">Company Vehicle</option>
                                <option value="rental_van">Rental Van</option>
                            </select>
                        </div>

                        {/* <div className="mb-6">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="technicianStatus">
                                Technician Status
                            </label>
                            <select
                                // onChange={(e) => setStatus(e.target.value)}
                                // selected={1}
                                // onChange={handleChange}
                                onChange={(e) => setTechnicianObj(technicianObj => ({...technicianObj, status: e.target.value}))}
                                selected={technicianObj.status}
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="1">Available</option>
                                <option value="2">Unavailable</option>
                            </select>
                        </div> */}

                        {/*<div className="mb-6">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="technicianSupportedAircon">
                                Technician Supported Aircon
                            </label>
                            <input
                                className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                id="supportedAircon"
                                type="text"
                                placeholder="Technician Supported Aircon"
                                value={technicianSupportedAircon}
                                onChange={(e) => setSupportedAircon(e.target.value)}
                            />
                        </div>*/}

                        {errorMessage && <div className="mb-4 text-sm text-red-500">{errorMessage}</div>}

                        <div className="flex items-center justify-center">
                            <button
                                className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                                type="submit"
                            >
                                Register technician
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default RegisterTechnician;