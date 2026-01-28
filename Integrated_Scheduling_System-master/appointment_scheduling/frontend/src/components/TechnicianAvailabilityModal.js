import React, { useState, useEffect } from 'react';
import { Modal, Button, TimePicker, message, Spin, Badge } from 'antd';
import { CalendarOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Calendar } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const TechnicianAvailabilityModal = ({ visible, onClose, technicianId }) => {
    const [loading, setLoading] = useState(false);
    const [selectedDates, setSelectedDates] = useState(new Set());
    const [currentMonth, setCurrentMonth] = useState(dayjs());
    const [workingHours, setWorkingHours] = useState({
        startTime: dayjs('09:00', 'HH:mm'),
        endTime: dayjs('18:00', 'HH:mm')
    });

    useEffect(() => {
        if (visible && technicianId) {
            loadExistingAvailability();
        }
    }, [visible, technicianId]);

    const loadExistingAvailability = async () => {
        setLoading(true);
        try {
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technician-availability/?technicianId=${technicianId}`
            );

            if (response.data && response.data.length > 0) {
                const newSelectedDates = new Set();
                let loadedStartTime = null;
                let loadedEndTime = null;

                response.data.forEach(record => {
                    if (record.specificDate && record.isAvailable) {
                        newSelectedDates.add(record.specificDate);
                        if (!loadedStartTime) {
                            loadedStartTime = dayjs(record.startTime, 'HH:mm');
                            loadedEndTime = dayjs(record.endTime, 'HH:mm');
                        }
                    }
                });

                setSelectedDates(newSelectedDates);
                if (loadedStartTime && loadedEndTime) {
                    setWorkingHours({
                        startTime: loadedStartTime,
                        endTime: loadedEndTime
                    });
                }
            }
        } catch (error) {
            console.error('Error loading availability:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateSelect = (date) => {
        const dateString = date.format('YYYY-MM-DD');
        const newSelectedDates = new Set(selectedDates);

        if (newSelectedDates.has(dateString)) {
            newSelectedDates.delete(dateString);
        } else {
            newSelectedDates.add(dateString);
        }

        setSelectedDates(newSelectedDates);
    };

    const dateCellRender = (date) => {
        const dateString = date.format('YYYY-MM-DD');
        const isSelected = selectedDates.has(dateString);
        const isPast = date.isBefore(dayjs(), 'day');

        return (
            <div
                onClick={() => !isPast && handleDateSelect(date)}
                className={`
                    w-full h-full flex items-center justify-center cursor-pointer
                    ${isSelected ? 'bg-blue-500 text-white rounded-full' : ''}
                    ${isPast ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100 rounded-full'}
                `}
                style={{ minHeight: '30px' }}
            >
                <span>{date.date()}</span>
            </div>
        );
    };

    const handleSave = async () => {
        if (selectedDates.size < 5) {
            message.error('You must select at least 5 working days');
            return;
        }

        setLoading(true);
        try {
            // First, delete all existing specific date records for this technician
            const existingResponse = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technician-availability/?technicianId=${technicianId}`
            );

            if (existingResponse.data && existingResponse.data.length > 0) {
                await Promise.all(
                    existingResponse.data
                        .filter(record => record.specificDate)
                        .map(record =>
                            axios.delete(
                                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technician-availability/${record.id}/`
                            )
                        )
                );
            }

            // Create new availability records for each selected date
            const promises = Array.from(selectedDates).map(dateString => {
                const date = dayjs(dateString);
                const dayOfWeek = date.format('dddd').toLowerCase();

                return axios.post(
                    `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technician-availability/`,
                    {
                        technicianId: technicianId,
                        specificDate: dateString,
                        dayOfWeek: dayOfWeek,
                        startTime: workingHours.startTime.format('HH:mm'),
                        endTime: workingHours.endTime.format('HH:mm'),
                        isAvailable: true
                    }
                );
            });

            await Promise.all(promises);

            message.success('Working days saved successfully!');
            onClose();
        } catch (error) {
            console.error('Error saving availability:', error);
            if (error.response?.data) {
                const errorMessage = typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data);
                message.error(`Failed to save schedule: ${errorMessage}`);
            } else {
                message.error('Failed to save working schedule. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMonthChange = (date) => {
        setCurrentMonth(date);
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <CalendarOutlined />
                    <span>Set Your Working Days</span>
                </div>
            }
            open={visible}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Cancel
                </Button>,
                <Button key="save" type="primary" onClick={handleSave} loading={loading}>
                    Save Schedule
                </Button>
            ]}
        >
            <Spin spinning={loading}>
                <div className="mb-4">
                    <p className="text-gray-600 mb-2">
                        Click on dates to select your working days. You must select at least 5 days.
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                        Note: Each appointment will block 2.5 hours (including travel time).
                    </p>

                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                        <span className="font-medium">Working Hours:</span>
                        <TimePicker
                            value={workingHours.startTime}
                            onChange={(time) => setWorkingHours({ ...workingHours, startTime: time })}
                            format="HH:mm"
                            placeholder="Start Time"
                        />
                        <span>to</span>
                        <TimePicker
                            value={workingHours.endTime}
                            onChange={(time) => setWorkingHours({ ...workingHours, endTime: time })}
                            format="HH:mm"
                            placeholder="End Time"
                        />
                        <span className="text-sm text-gray-500 ml-4">
                            Selected: {selectedDates.size} days
                        </span>
                    </div>
                </div>

                <div className="border rounded-lg p-4">
                    <Calendar
                        fullscreen={false}
                        value={currentMonth}
                        onSelect={handleDateSelect}
                        dateCellRender={dateCellRender}
                        onPanelChange={handleMonthChange}
                        headerRender={({ value, onChange }) => {
                            const month = value.month();
                            const year = value.year();

                            return (
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <Button
                                        icon={<LeftOutlined />}
                                        onClick={() => {
                                            const newValue = value.clone().month(month - 1);
                                            onChange(newValue);
                                            setCurrentMonth(newValue);
                                        }}
                                    />
                                    <span className="text-lg font-semibold">
                                        {value.format('MMMM YYYY')}
                                    </span>
                                    <Button
                                        icon={<RightOutlined />}
                                        onClick={() => {
                                            const newValue = value.clone().month(month + 1);
                                            onChange(newValue);
                                            setCurrentMonth(newValue);
                                        }}
                                    />
                                </div>
                            );
                        }}
                    />
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded">
                    <p className="text-sm text-blue-800">
                        💡 Tip: Click on multiple dates to select them. Selected dates will be highlighted in blue.
                    </p>
                </div>
            </Spin>
        </Modal>
    );
};

export default TechnicianAvailabilityModal;
