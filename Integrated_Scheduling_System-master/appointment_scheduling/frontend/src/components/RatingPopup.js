import React, { useState, useEffect } from 'react';
import { Modal, Rate, Button, message } from 'antd';
import api from '../axiosConfig';

const RatingPopup = ({ userType, userId, onComplete }) => {
    const [unratedAppointments, setUnratedAppointments] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [rating, setRating] = useState(0);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem('rating_prompted') === 'true') return;
        fetchUnratedAppointments();
    }, []);

    const fetchUnratedAppointments = async () => {
        try {
            const param = userType === 'customer'
                ? `customerId=${userId}`
                : `technicianId=${userId}`;
            const response = await api.get(`/api/appointments/unrated-completed/?${param}`);
            if (response.data && response.data.length > 0) {
                setUnratedAppointments(response.data);
                setVisible(true);
            }
        } catch (error) {
            console.error('Error fetching unrated appointments:', error);
        }
    };

    const handleSubmitRating = async () => {
        if (rating === 0) {
            message.warning('Please select a rating');
            return;
        }
        setLoading(true);
        try {
            const appt = unratedAppointments[currentIndex];
            const endpoint = userType === 'customer'
                ? `/api/appointments/${appt.id}/rate-technician/`
                : `/api/appointments/${appt.id}/rate-customer/`;
            const body = userType === 'customer'
                ? { rating, customerId: userId }
                : { rating, technicianId: userId };

            await api.post(endpoint, body);
            message.success('Rating submitted!');
            moveToNext();
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to submit rating');
        } finally {
            setLoading(false);
        }
    };

    const moveToNext = () => {
        setRating(0);
        if (currentIndex + 1 < unratedAppointments.length) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setVisible(false);
            sessionStorage.setItem('rating_prompted', 'true');
            if (onComplete) onComplete();
        }
    };

    const handleDismiss = () => {
        setVisible(false);
        sessionStorage.setItem('rating_prompted', 'true');
        if (onComplete) onComplete();
    };

    if (!visible || unratedAppointments.length === 0) return null;

    const currentAppt = unratedAppointments[currentIndex];
    const targetName = userType === 'customer'
        ? currentAppt.display?.technicianName || 'your technician'
        : currentAppt.display?.customerName || 'your customer';

    const apptDate = new Date(currentAppt.appointmentStartTime * 1000)
        .toLocaleString('en-SG', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

    return (
        <Modal
            title={`Rate your ${userType === 'customer' ? 'Technician' : 'Customer'}`}
            open={visible}
            onCancel={handleDismiss}
            footer={[
                <Button key="skip" onClick={moveToNext}>
                    Skip
                </Button>,
                <Button key="submit" type="primary" loading={loading}
                    onClick={handleSubmitRating} disabled={rating === 0}>
                    Submit Rating
                </Button>,
            ]}
            closable={true}
            maskClosable={false}
        >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ marginBottom: 8 }}>
                    Appointment on <strong>{apptDate}</strong>
                </p>
                <p style={{ marginBottom: 16 }}>
                    {userType === 'customer'
                        ? `How was your technician, ${targetName}?`
                        : `How was your customer, ${targetName}?`
                    }
                </p>
                <Rate
                    value={rating}
                    onChange={setRating}
                    style={{ fontSize: 36 }}
                />
                {unratedAppointments.length > 1 && (
                    <p style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
                        {currentIndex + 1} of {unratedAppointments.length} appointment(s) to rate
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default RatingPopup;
