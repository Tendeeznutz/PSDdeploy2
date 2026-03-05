import React, {useState, useEffect, useMemo} from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import {Link, useNavigate} from 'react-router-dom';
import api from "../axiosConfig";
import {Button, Modal, message} from 'antd';
import DeleteAppointmentPopup from "../components/DeleteAppointmentPopup";
import { ListItemIcon, MenuItem, Box } from '@mui/material';
import { Delete, PageviewRounded, Send, Update, LockReset, PersonOff, PersonAdd, ToggleOn, ToggleOff } from '@mui/icons-material';
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
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [resetPasswordTechnician, setResetPasswordTechnician] = useState(null);
    const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
    const [showCustomerResetPasswordModal, setShowCustomerResetPasswordModal] = useState(false);
    const [resetPasswordCustomer, setResetPasswordCustomer] = useState(null);
    const [resetPasswordCustomerLoading, setResetPasswordCustomerLoading] = useState(false);
    const [showToggleActiveModal, setShowToggleActiveModal] = useState(false);
    const [toggleActiveTechnician, setToggleActiveTechnician] = useState(null);
    const [toggleActiveLoading, setToggleActiveLoading] = useState(false);
    const [deactivationReason, setDeactivationReason] = useState('');

    const fetchAppointments = async () => {
        let url = `/api/appointments/`;

        if (filterStatus) {
            url += `?appointmentStatus=${filterStatus}`;
        }

        if (searchQuery) {
            switch (searchType) {
                case 'customerName':
                    url = `/api/appointments/?customerName=${searchQuery}`;
                    break;
                case 'customerPhone':
                    url = `/api/appointments/?customerPhone=${searchQuery}`;
                    break;
                case 'customerEmail':
                    url = `/api/appointments/?customerEmail=${searchQuery}`;
                    break;
                case 'customerPostal':
                    url = `/api/appointments/?customerPostalCode=${searchQuery}`;
                    break;
                case 'technicianName':
                    url = `/api/appointments/?technicianName=${searchQuery}`;
                    break;
                case 'technicianPhone':
                    url = `/api/appointments/?technicianPhone=${searchQuery}`;
                    break;
                case 'technicianPostal':
                    url = `/api/appointments/?technicianPostalCode=${searchQuery}`;
                    break;
                case 'date':
                    url = `/api/appointments/?appointmentStartTime=${searchQuery}`;
                    break;
                default:
                    break;
            }
        }

        try {
            const response = await api.get(url);
            setAppointments(response.data);
        } catch (error) {
            console.error('Error fetching appointments!', error);
        }
    };


    useEffect(() => {

        const fetchCustomers = async () => {
            let customerUrl = `/api/customers/`;

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
                const response = await api.get(customerUrl);
                setCustomers(response.data);
            } catch (error) {
                console.error('Error fetching customers!', error);
            }
        };

        const fetchTechnicians = async () => {
            let technicianUrl = `/api/technicians/`;

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

            try {
                const response = await api.get(technicianUrl);
                setTechnicians(response.data);
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
            await api.delete(`/api/appointments/${deleteAppointmentId}/`);
            fetchAppointments();
        } catch (error) {
            console.error('Error deleting appointment!', error);
        }
        setShowDeletePopup(false);
    };

    const handleCancelDelete = () => {
        setShowDeletePopup(false);
    };

    const handleOpenResetPasswordModal = (technician) => {
        setResetPasswordTechnician(technician);
        setShowResetPasswordModal(true);
    };

    const handleCancelResetPassword = () => {
        setShowResetPasswordModal(false);
        setResetPasswordTechnician(null);
    };

    const handleConfirmResetPassword = async () => {
        if (!resetPasswordTechnician) return;

        setResetPasswordLoading(true);
        try {
            const response = await api.post(
                `/api/technicians/${resetPasswordTechnician.id}/coordinator-reset-password/`
            );
            message.success(`Password for ${response.data.technicianName} has been reset to default (password123)`);
            setShowResetPasswordModal(false);
            setResetPasswordTechnician(null);
        } catch (error) {
            console.error('Error resetting password:', error);
            message.error('Failed to reset password. Please try again.');
        } finally {
            setResetPasswordLoading(false);
        }
    };

    const handleOpenCustomerResetPasswordModal = (customer) => {
        setResetPasswordCustomer(customer);
        setShowCustomerResetPasswordModal(true);
    };

    const handleCancelCustomerResetPassword = () => {
        setShowCustomerResetPasswordModal(false);
        setResetPasswordCustomer(null);
    };

    const handleConfirmCustomerResetPassword = async () => {
        if (!resetPasswordCustomer) return;

        setResetPasswordCustomerLoading(true);
        try {
            const response = await api.post(
                `/api/customers/${resetPasswordCustomer.id}/coordinator-reset-password/`
            );
            message.success(`Password for ${response.data.customerName} has been reset to default (password123). Email notification sent.`);
            setShowCustomerResetPasswordModal(false);
            setResetPasswordCustomer(null);
        } catch (error) {
            console.error('Error resetting customer password:', error);
            message.error('Failed to reset customer password. Please try again.');
        } finally {
            setResetPasswordCustomerLoading(false);
        }
    };

    const handleOpenToggleActiveModal = (technician) => {
        setToggleActiveTechnician(technician);
        setDeactivationReason('');
        setShowToggleActiveModal(true);
    };

    const handleCancelToggleActive = () => {
        setShowToggleActiveModal(false);
        setToggleActiveTechnician(null);
        setDeactivationReason('');
    };

    const handleConfirmToggleActive = async () => {
        if (!toggleActiveTechnician) return;

        setToggleActiveLoading(true);
        try {
            const response = await api.post(
                `/api/technicians/${toggleActiveTechnician.id}/toggle-active-status/`,
                { reason: deactivationReason }
            );

            if (response.data.isActive) {
                message.success(`${response.data.technicianName} has been reactivated`);
            } else {
                message.success(`${response.data.technicianName} has been deactivated`);
            }

            // Refresh technicians list
            const techResponse = await api.get(`/api/technicians/`);
            setTechnicians(techResponse.data);

            setShowToggleActiveModal(false);
            setToggleActiveTechnician(null);
            setDeactivationReason('');
        } catch (error) {
            console.error('Error toggling active status:', error);
            message.error('Failed to update technician status. Please try again.');
        } finally {
            setToggleActiveLoading(false);
        }
    };

    const handleToggleStatus = async (technician) => {
        try {
            const response = await api.post(
                `/api/technicians/${technician.id}/toggle-status/`
            );
            const newStatus = response.data.technicianStatus === '1' ? 'Available' : 'Unavailable';
            message.success(`${response.data.technicianName} is now ${newStatus}`);
            const techResponse = await api.get(`/api/technicians/`);
            setTechnicians(techResponse.data);
        } catch (error) {
            console.error('Error toggling status:', error);
            message.error('Failed to update technician status.');
        }
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
                    Cell: ({ row }) => {
                        const brands = row.original.display?.airconBrand || [];
                        const models = row.original.display?.airconModel || [];
                        const parts = brands.map((b, i) => {
                            const brand = b || '';
                            const model = models[i] || '';
                            return [brand, model].filter(Boolean).join(' ') || 'N/A';
                        });
                        return parts.join(', ') || 'N/A';
                    }
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
                },
            ]
        }
    ],
    [])

    const technicianColumn = useMemo(() => [
        {
            id: 'technician',
            header: 'Technicians',
            muiTableHeadCellProps: { align: 'center' },
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
                        <Box
                            component="span"
                            sx={(theme) => ({
                                backgroundColor: row.original.technicianStatus === '1'
                                    ? theme.palette.success.main
                                    : theme.palette.warning.main,
                                borderRadius: '0.25rem',
                                color: '#fff',
                                p: '0.25rem 0.5rem',
                                fontWeight: 'bold',
                            })}
                        >
                            {row.original.technicianStatus === '1' ? 'Available' : 'Unavailable'}
                        </Box>
                    )
                },
                {
                    accessorKey: 'technicianTravelType',
                    header: 'Travel Type',
                    size: 150,
                    Cell: ({ row }) => {
                        const travelTypes = {
                            'own_vehicle': 'Own Vehicle',
                            'rented_vehicle': 'Rented Vehicle',
                            'company_vehicle': 'Company Vehicle',
                        };
                        const travelType = row.original.technicianTravelType;
                        if (!travelType) return <span style={{ color: '#999', fontStyle: 'italic' }}>Not Set</span>;
                        return travelTypes[travelType] || travelType;
                    }
                },
                {
                    accessorKey: 'specializations',
                    header: 'Specializations',
                    size: 200,
                    Cell: ({ row }) => {
                        const specs = row.original.specializations;
                        if (!specs || specs.length === 0) return <span style={{ color: '#999', fontStyle: 'italic' }}>None</span>;
                        return specs.join(', ');
                    }
                },
                {
                    accessorKey: 'isActive',
                    header: 'Employment Status',
                    size: 150,
                    Cell: ({ row }) => (
                        <Box
                            component="span"
                            sx={(theme) => ({
                                backgroundColor: row.original.isActive !== false
                                    ? theme.palette.success.main
                                    : theme.palette.error.main,
                                borderRadius: '0.25rem',
                                color: '#fff',
                                p: '0.25rem 0.5rem',
                                fontWeight: 'bold',
                            })}
                        >
                            {row.original.isActive !== false ? 'Active' : 'Inactive'}
                        </Box>
                    )
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
        },
        enableRowActions: true,
        renderRowActionMenuItems: ({ closeMenu, row }) => [
            <MenuItem
                key={0}
                onClick={() => {
                    handleOpenResetPasswordModal(row.original);
                    closeMenu();
                }}
                sx={{ m: 0 }}
            >
                <ListItemIcon>
                    <LockReset />
                </ListItemIcon>
                Reset Password
            </MenuItem>,
            <MenuItem
                key={1}
                onClick={() => {
                    handleToggleStatus(row.original);
                    closeMenu();
                }}
                sx={{ m: 0 }}
            >
                <ListItemIcon>
                    {row.original.technicianStatus === '1' ? <ToggleOff /> : <ToggleOn />}
                </ListItemIcon>
                {row.original.technicianStatus === '1' ? 'Set Unavailable' : 'Set Available'}
            </MenuItem>,
            <MenuItem
                key={2}
                onClick={() => {
                    handleOpenToggleActiveModal(row.original);
                    closeMenu();
                }}
                sx={{ m: 0 }}
            >
                <ListItemIcon>
                    {row.original.isActive !== false ? <PersonOff /> : <PersonAdd />}
                </ListItemIcon>
                {row.original.isActive !== false ? 'Deactivate Technician' : 'Reactivate Technician'}
            </MenuItem>,
        ]
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
        },
        enableRowActions: true,
        renderRowActionMenuItems: ({ closeMenu, row }) => [
            <MenuItem
                key={0}
                onClick={() => {
                    handleOpenCustomerResetPasswordModal(row.original);
                    closeMenu();
                }}
                sx={{ m: 0 }}
            >
                <ListItemIcon>
                    <LockReset />
                </ListItemIcon>
                Reset Password
            </MenuItem>,
        ]
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
                window.location.href='/coordinator/appointmentView?id=' + row.original.id
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
                window.location.href='/coordinator/customerEnquiry?id=' + row.original.customerId + "&name=" + row.original.display.customerName
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
                window.location.href='/coordinator/appointmentUpdate?id=' + row.original.id
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
                    onClick={() => navigate('/coordinator/mailbox')}
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

            {/* Password Reset Confirmation Modal */}
            <Modal
                title="Reset Technician Password"
                open={showResetPasswordModal}
                onOk={handleConfirmResetPassword}
                onCancel={handleCancelResetPassword}
                okText="Reset Password"
                okButtonProps={{ danger: true, loading: resetPasswordLoading }}
                cancelButtonProps={{ disabled: resetPasswordLoading }}
            >
                <div className="py-4">
                    <p className="text-gray-700 mb-4">
                        Are you sure you want to reset the password for <strong>{resetPasswordTechnician?.technicianName}</strong>?
                    </p>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-700">
                            The password will be reset to the default: <strong>password123</strong>
                        </p>
                        <p className="text-sm text-yellow-600 mt-1">
                            An email notification will be sent to the technician.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Deactivate/Reactivate Technician Modal */}
            <Modal
                title={toggleActiveTechnician?.isActive !== false ? "Deactivate Technician" : "Reactivate Technician"}
                open={showToggleActiveModal}
                onOk={handleConfirmToggleActive}
                onCancel={handleCancelToggleActive}
                okText={toggleActiveTechnician?.isActive !== false ? "Deactivate" : "Reactivate"}
                okButtonProps={{
                    danger: toggleActiveTechnician?.isActive !== false,
                    loading: toggleActiveLoading,
                    style: toggleActiveTechnician?.isActive === false ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}
                }}
                cancelButtonProps={{ disabled: toggleActiveLoading }}
            >
                <div className="py-4">
                    {toggleActiveTechnician?.isActive !== false ? (
                        <>
                            <p className="text-gray-700 mb-4">
                                Are you sure you want to deactivate <strong>{toggleActiveTechnician?.technicianName}</strong>?
                            </p>
                            <div className="p-3 bg-red-50 border border-red-200 rounded mb-4">
                                <p className="text-sm text-red-700">
                                    This technician will no longer be able to log in or be assigned to appointments.
                                </p>
                                <p className="text-sm text-red-600 mt-1">
                                    Their data will be preserved and they can be reactivated later.
                                </p>
                            </div>
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason for deactivation (optional):
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="e.g., Contract ended, Performance issues, Resigned..."
                                    value={deactivationReason}
                                    onChange={(e) => setDeactivationReason(e.target.value)}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-gray-700 mb-4">
                                Are you sure you want to reactivate <strong>{toggleActiveTechnician?.technicianName}</strong>?
                            </p>
                            <div className="p-3 bg-green-50 border border-green-200 rounded">
                                <p className="text-sm text-green-700">
                                    This technician will be able to log in and be assigned to appointments again.
                                </p>
                                <p className="text-sm text-green-600 mt-1">
                                    An email notification will be sent to the technician.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Customer Password Reset Confirmation Modal */}
            <Modal
                title="Reset Customer Password"
                open={showCustomerResetPasswordModal}
                onOk={handleConfirmCustomerResetPassword}
                onCancel={handleCancelCustomerResetPassword}
                okText="Reset Password"
                okButtonProps={{ danger: true, loading: resetPasswordCustomerLoading }}
                cancelButtonProps={{ disabled: resetPasswordCustomerLoading }}
            >
                <div className="py-4">
                    <p className="text-gray-700 mb-4">
                        Are you sure you want to reset the password for <strong>{resetPasswordCustomer?.customerName}</strong>?
                    </p>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-700">
                            The password will be reset to: <strong>password123</strong>
                        </p>
                        <p className="text-sm text-yellow-600 mt-1">
                            An email notification will be sent to {resetPasswordCustomer?.customerEmail}.
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default CoordinatorHome;
