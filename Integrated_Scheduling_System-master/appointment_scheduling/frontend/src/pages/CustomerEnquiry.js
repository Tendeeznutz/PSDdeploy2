import React, {useEffect, useState} from 'react';
import api from "../axiosConfig";
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
            // Get coordinator info from localStorage
            const coordinatorId = localStorage.getItem("coordinators_id");
            const coordinatorName = localStorage.getItem("coordinators_name");

            // Send email (existing functionality)
            await api.post(`/api/appointments/sendEnquiry/`, formData);

            // Save message to database for in-app messaging system
            if (coordinatorId && coordinatorName) {
                await api.post(`/api/messages/`, {
                    senderId: coordinatorId,
                    senderType: 'coordinator',
                    senderName: coordinatorName,
                    recipientId: formData.customerId,
                    recipientType: 'customer',
                    recipientName: custName,
                    subject: formData.emailSubject,
                    body: formData.emailBody
                });
            }

            message.success('Enquiry sent successfully! Customer will receive email and message notification.');
        } catch (error) {
            // Handle error
            console.error('Error submitting form:', error);
            message.error('Error sending enquiry');
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
                            href="/coordinator/home"
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
