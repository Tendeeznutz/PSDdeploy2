import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from "axios";
import Background from '../components/BackgroundWallpaper';

function TechnicianLogin() {
    const [technicianPhone, setUsername] = useState('');
    const [technicianPassword, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        console.log('Login Details:', { technicianPhone, technicianPassword });
        // if username and password correct, go to home page
        try {
            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technicians/login/`, {
                technicianPhone,
                technicianPassword
            });
            console.log('Login successful:', response.data);
            // Save technician ID to local storage
            localStorage.setItem('technicianPhone', response.data.technicianPhone);
            console.log('technicianPhone:', localStorage.getItem('technicianPhone'));
            navigate('/technicianhome'); // Navigate to home on successful login
        } catch (error) {
            console.error('Login failed:', error.response);
            setErrorMessage('Login failed. Please try again.');
        }
    }

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <Background>
            <div className="p-12 bg-white rounded shadow-md">
                <h1 className='text-lg'>Technician Login</h1>
                <p className="text-xs italic text-gray-500">Please fill in your credentials to login.</p>
                <hr className="my-4" />
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="technicianPhone">
                            Phone
                        </label>
                        <input
                            className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            id="technicianPhone"
                            type="text"
                            placeholder="Phone"
                            value={technicianPhone}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="password">
                            Password
                        </label>
                        <input
                            className="w-full p-2 leading-tight text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            id="password"
                            type="password"
                            placeholder="*********"
                            value={technicianPassword}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <p className="text-xs italic text-red-500">{errorMessage}</p>
                    <div className="flex items-center justify-between">
                        <button
                            className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                            type="submit"
                        >
                            Sign In
                        </button>
                    </div>
                </form>
                <Link to="/" className="fixed bottom-4 right-4 px-4 py-4 text-base text-white bg-green-500 rounded hover:bg-green-700 focus:outline-none focus:shadow-outline">
                    Customer Login
                </Link>
            </div>
            </Background>
        </div>
    );
}

export default TechnicianLogin;
