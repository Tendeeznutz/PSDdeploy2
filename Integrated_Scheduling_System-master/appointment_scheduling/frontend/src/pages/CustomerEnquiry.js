import React, {useEffect, useState} from 'react';
import axios from 'axios';
import {message, Button} from "antd";

const CustomerEnquiry = () => {
    const custId = new URLSearchParams(window.location.search).get('id');
    const custName = new URLSearchParams(window.location.search).get('name');
    const [formData, setFormData] = useState({
        customerId: custId,
        emailSubject: '',
        emailBody: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/sendEnquiry/`, formData);
            // Handle successful response
            console.log(response.data);
            message.success('Enquiry email sent successfully!');
        } catch (error) {
            // Handle error
            console.error('Error submitting form:', error);
            message.error('Error sending enquiry email');
        }
    };

    return (
        <div className="w-full h-full bg-gray-100">
            <div className="flex items-center justify-center p-5">
                <div className="w-2/6 p-6 m-40 bg-white rounded-xl shadow-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Customer Enquiry</h2>
                    <form onSubmit={handleSubmit}>
                        {/*Customer name*/}
                        <div className="mb-4">
                            <label htmlFor="customerName" className="block">Customer Name:</label>
                            <input
                                type="text"
                                id="customerName"
                                name="customerName"
                                // value={formData.customerName}
                                value={custName}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-md"
                                disabled={true}
                            />
                        </div>

                        <div className="mb-4">
                            <label htmlFor="emailSubject" className="block">Email Subject:</label>
                            <input
                                type="text"
                                id="emailSubject"
                                name="emailSubject"
                                value={formData.emailSubject}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-md"
                            />
                        </div>

                        <div className="mb-4">
                            <label htmlFor="emailBody" className="block">Email Body:</label>
                            <textarea
                                id="emailBody"
                                name="emailBody"
                                value={formData.emailBody}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-md"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300"
                        >
                            Send Enquiry Email
                        </button>
                        {/*back button*/}
                        <Button
                            href="/CoordinatorHome"
                            type="primary"
                            className="w-full mt-4"
                        >
                            Back
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );

};

export default CustomerEnquiry;
