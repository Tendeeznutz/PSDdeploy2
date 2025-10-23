import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReportIssues from '../pages/ReportIssues';
import { Box, ListItemIcon, MenuItem } from '@mui/material';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { PageviewRounded } from '@mui/icons-material';

function Home() {
    const customer_id = localStorage.getItem("customers_id");
    const navigate = useNavigate();
    const [appointmentList, setAppointmentList] = useState([]);

    const goToReportIssues = () => {
        navigate('/ReportIssues');
    }
    
    const getAllAppointments = () => {
        try {
            const allAppointmentResponse = axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?customerId=${customer_id}`);
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
    
        // Format the date as a string
        return date.toLocaleString();
    }

    useEffect(() => {
        if (!customer_id) {
            navigate('/error');
        } else {
            getAllAppointments().then((response) => { setAppointmentList(response.data) });
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
        renderRowActionMenuItems: ({ closeMenu, row}) => [
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
        ]
    })

    return (
        
        <div className="container mx-auto p-4">

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold mb-4">Appointments</h1>
                <button onClick={goToReportIssues}>Report Issues</button>
            </div>
            <h1 className="text-2xl font-semibold mb-4">Upcoming Appointments</h1>
            <MaterialReactTable table={apptTable}/>
        </div>
    );
}

export default Home;
