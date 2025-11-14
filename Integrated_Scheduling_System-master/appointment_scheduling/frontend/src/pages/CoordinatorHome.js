import React, {useState, useEffect, useMemo} from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import {Link, useNavigate} from 'react-router-dom';
import axios from 'axios';
import {Button} from 'antd';
import DeleteAppointmentPopup from "../components/DeleteAppointmentPopup";
import { ListItemIcon, MenuItem, Box } from '@mui/material';
import { Delete, PageviewRounded, Send, Update } from '@mui/icons-material';
import { MailOutlined } from '@ant-design/icons';

function CoordinatorHome() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [filterStatus, setFilterStatus] = useState('');
    const [searchType, setSearchType] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [customers, setCustomers] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [reschedAppts, setReschedAppts] = useState([]);
    const [reschedApptID, setReschedApptID] = useState([]);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [technicianSearchQuery, setTechnicianSearchQuery] = useState('');
    const [rescheduleSearchQuery, setRescheduleSearchQuery] = useState('');
    const [formattedTime, setFormattedTime] = useState([]);
    const [customerSearchType, setCustomerSearchType] = useState('');
    const [technicianSearchType, setTechnicianSearchType] = useState('');
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deleteAppointmentId, setDeleteAppointmentId] = useState('');

    const fetchAppointments = async () => {
        let url = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/`;

        if (filterStatus) {
            url += `?appointmentStatus=${filterStatus}`;
        }

        if (searchQuery) {
            switch (searchType) {
                case 'customerName':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?customerName=${searchQuery}`;
                    break;
                case 'customerPhone':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?customerPhone=${searchQuery}`;
                    break;
                case 'customerEmail':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?customerEmail=${searchQuery}`;
                    break;
                case 'customerPostal':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?customerPostalCode=${searchQuery}`;
                    break;
                case 'technicianName':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?technicianName=${searchQuery}`;
                    break;
                case 'technicianPhone':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?technicianPhone=${searchQuery}`;
                    break;
                case 'technicianPostal':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?technicianPostalCode=${searchQuery}`;
                    break;
                case 'date':
                    url = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?appointmentStartTime=${searchQuery}`;
                    break;
                default:
                    break;
            }
        }

        try {
            const response = await axios.get(url);
            setAppointments(response.data);
            console.log('Appointments fetched:', response.data);
        } catch (error) {
            console.error('Error fetching appointments!', error);
        }
    };


    useEffect(() => {

        const fetchCustomers = async () => {
            let customerUrl = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/customers/`;

            if (customerSearchQuery && customerSearchType) {
                const searchParam = {
                    'customerName': 'customerName',
                    'customerPhone': 'customerPhone',
                    'customerEmail': 'customerEmail',
                    'customerPostal': 'customerPostalCode',
                }[customerSearchType];

                if (searchParam) {
                    customerUrl += `?${searchParam}=${customerSearchQuery}`;
                }
            }

            try {
                console.log('Customer URL:', customerUrl);
                const response = await axios.get(customerUrl);
                setCustomers(response.data);
                console.log('Customers searched:', response.data);
            } catch (error) {
                console.error('Error fetching customers!', error);
            }
        };

        const fetchTechnicians = async () => {
            let technicianUrl = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technicians/`;

            if (technicianSearchQuery && technicianSearchType) {
                const searchParam = {
                    'technicianName': 'technicianName',
                    'technicianPhone': 'technicianPhone',
                    'technicianPostal': 'technicianPostalCode',
                    'technicianTravelType': 'technicianTravelType',
                }[technicianSearchType];

                if (searchParam) {
                    technicianUrl += `?${searchParam}=${technicianSearchQuery}`;
                }
            }

            console.log(technicianUrl);

            try {
                const response = await axios.get(technicianUrl);
                setTechnicians(response.data);
                console.log('Technicians fetched:', response.data);
            } catch (error) {
                console.error('Error fetching technicians!', error);
            }
        };

        fetchAppointments();
        fetchCustomers();
        fetchTechnicians();
        //fetchRescheduleAppt();
    }, [filterStatus, searchType, searchQuery, customerSearchQuery, customerSearchType, technicianSearchQuery]);

    const handleOpenDeletePopup = (appointmentId) => {
        setDeleteAppointmentId(appointmentId);
        setShowDeletePopup(true);
    };

    const handleConfirmDelete = async () => {
        try {
            await axios.delete(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/${deleteAppointmentId}/`);
            fetchAppointments();
        } catch (error) {
            console.error('Error deleting appointment!', error);
        }
        setShowDeletePopup(false);
    };

    const handleCancelDelete = () => {
        setShowDeletePopup(false);
    };

    // Function to convert Unix timestamp to formatted date string
    function formatUnixTimestamp(unixTimestamp) {
        // Create a new Date object
        const date = new Date(unixTimestamp * 1000);
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

    const handleStatusChange = (e) => {
        setFilterStatus(e.target.value);
    };

    const handleSearchTypeChange = (e) => {
        setSearchType(e.target.value);
    };

    const handleSearchQueryChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleCustomerSearchQueryChange = (e) => {
        setCustomerSearchQuery(e.target.value);
    };

    const handleCustomerSearchTypeChange = (event) => {
        setCustomerSearchType(event.target.value);
    };

    const handleTechnicianSearchQueryChange = (e) => {
        setTechnicianSearchQuery(e.target.value);
    };

    const handleTechnicianSearchTypeChange = (e) => {
        setTechnicianSearchType(e.target.value);
    }

    const handleRescheduleSearchQuery = (e) => {
        setRescheduleSearchQuery(e.target.value);
    };

    const getStatusClass = (status) => {
        const statusClasses = {
            'pending': 'text-orange-500',
            'Pending': 'text-orange-500',
            'Confirmed': 'text-green-500',
            'Completed': 'text-blue-500',
            'Cancelled': 'text-red-500'
        };

        return statusClasses[status] || 'text-gray-500'; // Default color
    };

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
                        formatUnixTimestamp(row.original.appointmentStartTime)
                    )
                },
                {
                    accessorKey: 'display.airconToService',
                    header: 'Aircon Name',
                    size: 150
                },
                {
                    accessorKey: 'display.airconBrand',
                    header: 'Aircon Model/Brand',
                    size: 150,
                    Cell: ({ row }) => (
                        row.original.display.airconBrand + " " +  row.original.display.airconModel
                    )
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
                    accessorKey: 'display.customerName',
                    header: 'Customer',
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
                },
            ]
        }
    ],
    [])

    const technicianColumn = useMemo(() => [
        {
            id: 'technician',
            header: 'Technicians',
            columns: [
                {
                    accessorKey: 'technicianName',
                    header: 'Technician Name',
                    size: 150
                },
                {
                    accessorKey: 'technicianPostalCode',
                    header: 'Postal Code',
                    size: 150
                },
                {
                    accessorKey: 'technicianAddress',
                    header: 'Address',
                    size: 150
                },
                {
                    accessorKey: 'technicianPhone',
                    header: 'Phone',
                    size: 150
                },
                {
                    id: 'technicianStatus',
                    header: 'Status',
                    size: 150,
                    Cell: ({ row }) => (
                        row.original.technicianStatus === '1' ? 'Available' : 'Unavailable'
                    )
                },
                {
                    accessorKey: 'technicianTravelType',
                    header: 'Travel Type',
                    size: 150
                },
            ]
        }
    ],
    [])

    const customerColumn = useMemo(() => [
        {
            id: 'customer',
            header: 'Customers',
            columns: [
                {
                    accessorKey: 'customerName',
                    header: 'Customer Name',
                    size: 150
                },
                {
                    accessorKey: 'customerPostalCode',
                    header: 'Postal Code',
                    size: 150
                },
                {
                    accessorKey: 'customerAddress',
                    header: 'Address',
                    size: 150
                },
                {
                    accessorKey: 'customerPhone',
                    header: 'Phone',
                    size: 150
                },
                {
                    accessorKey: 'customerEmail',
                    header: 'Email',
                    size: 150
                },
            ]
        }
    ],
    [])

    const technicianTable = useMaterialReactTable({
        columns: technicianColumn, 
        data: technicians,
        initialState: {
            showGlobalFilter: true,
            density: 'spacious',
            columnPinning: {
                right: ['mrt-row-actions']
            }
        }
    });

    const customerTable = useMaterialReactTable({
        columns: customerColumn,
        data: customers,
        initialState: {
            showGlobalFilter: true,
            density: 'spacious',
            columnPinning: {
                right: ['mrt-row-actions']
            }
        }
    });

    const apptTable = useMaterialReactTable({
        columns: appointmentColumn,
        data: appointments,
        initialState: {
            showGlobalFilter: true,
            density: 'spacious',
            columnPinning: {
                right: ['mrt-row-actions']
            }
        },
        enableRowActions: true,
        renderRowActionMenuItems: ({ closeMenu, row }) => [
            <MenuItem
            key={0}
            onClick={() => {
                window.location.href='/CoordinatorAppointmentView?id=' + row.original.id
                closeMenu();
            }}
            sx={{ m: 0 }}
            >
                <ListItemIcon>
                    <PageviewRounded/>
                </ListItemIcon>
                View
            </MenuItem>,
            <MenuItem
            key={1}
            onClick={() => {
                window.location.href='/CustomerEnquiry?id=' + row.original.customerId + "&name=" + row.original.display.customerName
                closeMenu();
            }}
            sx={{ m: 0 }}
            >
                <ListItemIcon>
                    <Send/>
                </ListItemIcon>
                Send Enquiry
            </MenuItem>,
            <MenuItem
            key={2}
            onClick={() => {
                window.location.href='/CoordinatorAppointmentUpdate?id=' + row.original.id
                closeMenu();
            }}
            sx={{ m: 0 }}
            >
                <ListItemIcon>
                    <Update/>
                </ListItemIcon>
                Update
            </MenuItem>,
            <MenuItem
            key={3}
            onClick={() => {
                //window.location.href='/appointmentDetail?id=' + row.original.id
                handleOpenDeletePopup(row.original.id)
                closeMenu();
            }}
            sx={{ m: 0 }}
            >
                <ListItemIcon>
                    <Delete/>
                </ListItemIcon>
                Delete
            </MenuItem>,
        ]
    })

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-semibold">Coordinator Dashboard</h1>
                <Button
                    type="primary"
                    icon={<MailOutlined />}
                    onClick={() => navigate('/mailbox')}
                    size="large"
                >
                    Mailbox
                </Button>
            </div>

            {/* Appointments Table */}
            <MaterialReactTable table={apptTable} />
            <br/>
            {/* Customers Table */}
            <MaterialReactTable table={customerTable} />
            <br/>
            {/* Technicians Table */}
            <MaterialReactTable table={technicianTable} />
            <DeleteAppointmentPopup
                visible={showDeletePopup}
                onCancel={handleCancelDelete}
                onConfirmDelete={handleConfirmDelete}
            />
        </div>
    );
}

export default CoordinatorHome;
