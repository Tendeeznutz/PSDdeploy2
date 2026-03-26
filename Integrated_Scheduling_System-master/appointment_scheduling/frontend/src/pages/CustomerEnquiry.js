import React, { useState } from 'react';
import { Button, Input, message } from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import api from '../axiosConfig';
import OwnedCard from '../components/ui/OwnedCard';
import OwnedPageHeader from '../components/ui/OwnedPageHeader';
import OwnedPageShell from '../components/ui/OwnedPageShell';

const { TextArea } = Input;

function CustomerEnquiry() {
    const navigate = useNavigate();
    const customerId = new URLSearchParams(window.location.search).get('id');
    const customerName = new URLSearchParams(window.location.search).get('name');
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        customerId,
        emailSubject: '',
        emailBody: '',
    });

    const handleFieldChange = (field, value) => {
        setFormData((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formData.customerId || !customerName) {
            message.error('Customer details are missing for this enquiry.');
            return;
        }

        if (!formData.emailSubject.trim() || !formData.emailBody.trim()) {
            message.warning('Please enter both a subject and a message.');
            return;
        }

        setSubmitting(true);
        try {
            const coordinatorId = localStorage.getItem('coordinators_id');
            const coordinatorName = localStorage.getItem('coordinators_name');

            await api.post('/api/appointments/sendEnquiry/', formData);

            if (coordinatorId && coordinatorName) {
                await api.post('/api/messages/', {
                    senderId: coordinatorId,
                    senderType: 'coordinator',
                    senderName: coordinatorName,
                    recipientId: formData.customerId,
                    recipientType: 'customer',
                    recipientName: customerName,
                    subject: formData.emailSubject.trim(),
                    body: formData.emailBody.trim(),
                });
            }

            message.success('Enquiry sent successfully. The customer will receive both the email and mailbox message.');
            setFormData({
                customerId,
                emailSubject: '',
                emailBody: '',
            });
        } catch (error) {
            console.error('Error submitting enquiry:', error);
            message.error('Error sending enquiry.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            <OwnedPageShell narrow>
                <OwnedPageHeader
                    eyebrow="Customer enquiry"
                    title="Send a customer update"
                    description="Use a clear subject and concise message so the customer can quickly understand what action or update relates to their booking."
                    actions={(
                        <Button
                            icon={<ArrowLeftOutlined />}
                            className="owned-secondary-button"
                            onClick={() => navigate('/coordinator/home')}
                        >
                            Back to home
                        </Button>
                    )}
                />

                <OwnedCard className="p-5 md:p-6">
                    <div className="owned-inline-note mb-6">
                        This sends the enquiry through the current email flow and also saves it to the in-app mailbox for easier follow-up.
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="owned-field">
                            <label htmlFor="enquiry-customer" className="owned-field__label">Customer</label>
                            <Input
                                id="enquiry-customer"
                                value={customerName || 'Unknown customer'}
                                disabled
                                className="owned-input"
                            />
                        </div>

                        <div className="owned-field">
                            <label htmlFor="enquiry-subject" className="owned-field__label">Subject</label>
                            <Input
                                id="enquiry-subject"
                                value={formData.emailSubject}
                                onChange={(event) => handleFieldChange('emailSubject', event.target.value)}
                                placeholder="Enter a short subject line"
                                maxLength={200}
                                className="owned-input"
                            />
                        </div>

                        <div className="owned-field">
                            <label htmlFor="enquiry-body" className="owned-field__label">Message</label>
                            <TextArea
                                id="enquiry-body"
                                value={formData.emailBody}
                                onChange={(event) => handleFieldChange('emailBody', event.target.value)}
                                placeholder="Explain the update, question, or action the customer should know about."
                                rows={9}
                                maxLength={2000}
                                className="owned-input"
                            />
                        </div>

                        <div className="owned-action-row pt-2">
                            <Button
                                className="owned-secondary-button"
                                onClick={() => navigate('/coordinator/mailbox')}
                            >
                                Go to mailbox
                            </Button>
                            <Button
                                htmlType="submit"
                                className="owned-primary-button"
                                icon={<SendOutlined />}
                                loading={submitting}
                            >
                                Send enquiry
                            </Button>
                        </div>
                    </form>
                </OwnedCard>
            </OwnedPageShell>
        </div>
    );
}

export default CustomerEnquiry;
