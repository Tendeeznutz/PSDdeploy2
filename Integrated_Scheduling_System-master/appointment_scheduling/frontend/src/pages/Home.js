import React, { useState, useEffect, useMemo } from 'react';
import api from "../axiosConfig";
import { useNavigate } from 'react-router-dom';
import ReportIssues from '../pages/ReportIssues';
import { Box, ListItemIcon, MenuItem } from '@mui/material';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { PageviewRounded, CancelOutlined } from '@mui/icons-material';
import { MailOutlined } from '@ant-design/icons';
import { Badge, Modal, message } from 'antd';

function Home() {
    const customer_id = localStorage.getItem("customers_id");
    const navigate = useNavigate();
    const [appointmentList, setAppointmentList] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const goToReportIssues = () => {
        navigate('/customer/ReportIssues');
    }

    const goToMailbox = () => {
        navigate('/customer/mailbox');
    }

    const handleCancelAppointment = async (appointmentId, appointmentStartTime) => {
        // Check if appointment is more than 48 hours away
        const now = Math.floor(Date.now() / 1000); // Current time in Unix seconds
        const hoursUntilAppointment = (appointmentStartTime - now) / 3600;

        if (hoursUntilAppointment < 48) {
            message.error('Cannot cancel appointment within 48 hours of scheduled time');
            return;
        }

        Modal.confirm({
            title: 'Cancel Appointment',
            content: 'Are you sure you want to cancel this appointment?',
            okText: 'Yes, Cancel',
            okType: 'danger',
            cancelText: 'No, Keep It',
            onOk: async () => {
                try {
                    await api.patch(
                        `/api/appointments/${appointmentId}/`,
                        {
                            appointmentStatus: '4', // 4 = Cancelled
                            cancellationReason: 'Cancelled by customer',
                            cancelledBy: 'customer'
                        }
                    );
                    message.success('Appointment cancelled successfully');
                    // Refresh the appointment list
                    const response = await getAllAppointments();
                    setAppointmentList(response.data);
                } catch (error) {
                    console.error('Error cancelling appointment:', error);
                    message.error('Failed to cancel appointment. Please try again.');
                }
            }
        });
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await api.get(
                `/api/messages/unread-count/`,
                {
                    params: {
                        recipientId: customer_id,
                        recipientType: 'customer'
                    }
                }
            );
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };
    
    const getAllAppointments = () => {
        try {
            const allAppointmentResponse = api.get(`/api/appointments/?customerId=${customer_id}`);
            return allAppointmentResponse;
        } catch (error) {
            console.error(error.message);
        }
    }

    // Function to convert Unix timestamp to formatted date string
    function formatUnixTimestamp(unixTimestamp) {
        // Convert Unix time to milliseconds

        // Create a new Date object
        const date = new Date(unixTimestamp*1000);

        // Format the date as a string without seconds
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    useEffect(() => {
        if (!customer_id) {
            navigate('/error');
        } else {
            getAllAppointments().then((response) => { setAppointmentList(response.data) });
            fetchUnreadCount();
        }
    }, []);

    const appointmentColumn = useMemo(() => [
        {
            id: 'appointment',
            header: 'Appointments',
            columns: [
                {
                    accessorKey: 'appointmentStartTime',
                    header: 'Appointment Date/Time',
                    size: 150,
                    Cell: ({ row }) => (
                        formatUnixTimestamp(row.original.appointmentStartTime) + " " + formatUnixTimestamp(row.original.appointmentEndTime)
                    )
                },
                {
                    accessorKey: 'display.airconToService',
                    header: 'Aircon to be serviced',
                    size: 150
                },
                {
                    accessorKey: 'customerFeedback',
                    header: 'Feedback',
                    size: 150,
                    Cell: ({ row }) => (
                        row.original.customerFeedback ? row.original.customerFeedback : "No feedback"
                    )
                },
                {
                    accessorKey: 'display.technicianName',
                    header: 'Technician',
                    size: 150,
                    Cell: ({ row }) => (
                        row.original.display.technicianName ? row.original.display.technicianName : "No technician assigned"
                    )
                },
                {
                    accessorKey: 'display.paymentMethod',
                    header: 'Payment Method',
                    size: 150
                },
                {
                    accessorKey: 'display.appointmentStatus',
                    header: 'Status',
                    size: 150,
                    Cell: ({ row }) => (
                        <Box
                        component="span"
                        sx={(theme) => ({
                            backgroundColor:
                            row.original.display.appointmentStatus == "Pending" ? 
                            theme.palette.warning.main : row.original.display.appointmentStatus == "Completed"
                            ? theme.palette.success.main : row.original.display.appointmentStatus == "Confirmed" 
                            ? theme.palette.info.main : theme.palette.error.main,
                            borderRadius: '0.25rem',
                            color: '#fff',
                            maxWidth: '9ch',
                            p: '0.25rem'
                        })} 
                        >
                            {row.original.display.appointmentStatus}
                        </Box>
                    )
                }
            ]
        }
    ],
    [])

    const apptTable = useMaterialReactTable({
        columns: appointmentColumn,
        data: appointmentList,
        initialState: {
            showGlobalFilter: true,
            density: 'spacious',
            columnPinning: {
                right: ['mrt-row-actions']
            },
        },
        enableRowActions: true,
        renderRowActionMenuItems: ({ closeMenu, row}) => {
            const now = Math.floor(Date.now() / 1000);
            const hoursUntilAppointment = (row.original.appointmentStartTime - now) / 3600;
            const status = row.original.appointmentStatus;
            // Can only cancel if: more than 48 hours away AND status is Pending (1) or Confirmed (2)
            const canCancel = hoursUntilAppointment >= 48 && (status === '1' || status === '2');

            const menuItems = [
                <MenuItem
                    key={0}
                    onClick={() => {
                        navigate('/appointmentDetail?id=' + row.original.id);
                        closeMenu();
                    }}
                    sx={{ m: 0 }}
                >
                    <ListItemIcon>
                        <PageviewRounded/>
                    </ListItemIcon>
                    View
                </MenuItem>
            ];

            if (canCancel) {
                menuItems.push(
                    <MenuItem
                        key={1}
                        onClick={() => {
                            handleCancelAppointment(row.original.id, row.original.appointmentStartTime);
                            closeMenu();
                        }}
                        sx={{ m: 0, color: 'error.main' }}
                    >
                        <ListItemIcon>
                            <CancelOutlined color="error"/>
                        </ListItemIcon>
                        Cancel Appointment
                    </MenuItem>
                );
            }

            return menuItems;
        }
    })

    return (
        
        <div className="container mx-auto p-4">

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold mb-4">Appointments</h1>
                <div className="flex gap-3">
                    <button
                        onClick={goToMailbox}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                        <MailOutlined style={{ fontSize: '18px' }} />
                        Messages
                        {unreadCount > 0 && (
                            <Badge count={unreadCount} />
                        )}
                    </button>
                    <button
                        onClick={goToReportIssues}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                    >
                        Report Issues
                    </button>
                </div>
            </div>
            <h1 className="text-2xl font-semibold mb-4">Upcoming Appointments</h1>
            <MaterialReactTable table={apptTable}/>
        </div>
    );
}

export default Home;
