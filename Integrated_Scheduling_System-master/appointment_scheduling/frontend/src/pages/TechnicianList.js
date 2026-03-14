import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from "../axiosConfig";

function TechnicianList() {
    const [technicians, setTechnicians] = useState([]);

    useEffect(() => {
        api.get('/api/technicians/')
            .then(response => setTechnicians(response.data))
            .catch(error => console.error('Error fetching technicians:', error));
    }, []);

    return (
        <div className="container mx-auto p-4">

            <h1 className="text-2xl font-semibold mb-4">List of Technicians</h1>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-800 text-white">
                    <tr>
                        <th className="w-1/5 px-4 py-2">Name</th>
                        <th className="w-1/5 px-4 py-2">Phone</th>
                        <th className="w-1/5 px-4 py-2">Status</th>
                        <th className="w-1/5 px-4 py-2">Address</th>
                        <th className="w-1/5 px-4 py-2">Postal Code</th>
                    </tr>
                    </thead>
                    <tbody>
                    {technicians.map(technician => (
                        <tr key={technician.id} className="text-center border-b">
                            <td className="px-4 py-2">{technician.technicianName}</td>
                            <td className="px-4 py-2">{technician.technicianPhone}</td>
                            <td className="px-4 py-2">{technician.technicianStatus}</td>
                            <td className="px-4 py-2">{technician.technicianAddress}</td>
                            <td className="px-4 py-2">{technician.technicianPostalCode}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TechnicianList;
