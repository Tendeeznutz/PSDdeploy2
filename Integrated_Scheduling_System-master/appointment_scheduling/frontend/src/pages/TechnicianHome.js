import React, {useState, useEffect, useMemo} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import api from "../axiosConfig";
import { Box, ListItem, ListItemIcon, MenuItem } from '@mui/material';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { EventAvailable, PageviewRounded, PunchClock, LocationOn } from '@mui/icons-material';
import { Button } from 'antd';
import { MailOutlined, CalendarOutlined } from '@ant-design/icons';
import TechnicianAvailabilityModal from '../components/TechnicianAvailabilityModal';

// ...

function TechnicianHome() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [appointmentStatuses, setAppointmentStatuses] = useState([]);
    const [customerData, setCustomerData] = useState({}); // Store customer data by appointment ID
    const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);

    // Function to open Google Maps with customer's location
    const openGoogleMaps = (address, postalCode) => {
        const query = encodeURIComponent(`${address} Singapore ${postalCode}`);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    };


// Function to format ISO 8601 datetime string to desired format
    const formatDatetime = (isoDatetime) => {
        const date = new Date(isoDatetime);

        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');

        const formattedDatetime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        return formattedDatetime;
    };

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

    // const CheckIn = (appointmentId) => {
    //     console.log("Check in for appointment: " + appointmentId);
    //     axios.put(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/${appointmentId}/`, {
    //         appointmentStatus: "2"
    //     })
    //         .then(response => {
    //             console.log(response);
    //         })
    //         .catch(error => {
    //             console.error('There was an error!', error);
    //         });
    //     window.location.reload();

    // }

    const CompleteJob = (appointmentId) => {
        api.put(`/api/appointments/${appointmentId}/`, {
            appointmentStatus: "3"
        })
            .then(response => {
                console.log(response);
            })
            .catch(error => {
                console.error('There was an error!', error);
            });
        window.location.reload();

    }

    function displayApptStatus(apptStatus) {
        switch(apptStatus) {
            case "1":
                return "Pending Admin Action";
            case "2":
                return "Upcoming";
            case "3":
                return "Completed";
            case "4":
                return "Cancelled";
            default:
                return "Unknown Status";
        }
    };

    useEffect(() => {
        api.get(`/api/technicians/?technicianId=` + localStorage.getItem("technicians_id"))
            .then(response => {
                    localStorage.setItem("technicians_phone", response.data[0].phone);
                    localStorage.setItem("technicians_email", response.data[0].email);
                    localStorage.setItem("technicians_name", response.data[0].technicianName);
                }
            )
            .catch(error => {
                    console.error('There was an error!', error);
                }
            );
        api.get(`/api/appointments/?technicianId=${localStorage.getItem("technicians_id")}`)
            .then(response => {
                setAppointments(response.data);

                // Fetch customer data for each unique customer
                const uniqueCustomerIds = [...new Set(response.data.map(appt => appt.customerId))];
                const customerDataMap = {};

                Promise.all(
                    uniqueCustomerIds.map(customerId =>
                        api.get(`/api/customers/${customerId}/`)
                            .then(customerResponse => {
                                customerDataMap[customerId] = {
                                    address: customerResponse.data.customerAddress,
                                    postalCode: customerResponse.data.customerPostalCode,
                                    name: customerResponse.data.customerName,
                                    phone: customerResponse.data.customerPhone
                                };
                            })
                            .catch(customerError => {
                                console.error('Error fetching customer details:', customerError);
                            })
                    )
                ).then(() => {
                    setCustomerData(customerDataMap);
                    // For backward compatibility, set the first customer's address
                    if (response.data.length > 0) {
                        const firstCustomerId = response.data[0].customerId;
                        if (customerDataMap[firstCustomerId]) {
                            setAddresses(customerDataMap[firstCustomerId].address);
                        }
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching appointments:', error);
            });
    }, []);

    const appointmentColumn = useMemo(() => [
        {
            id: 'appointment',
            header: 'Appointments',
            columns: [
                {
                    accessorKey: 'appointmentStartTime',
                    header: 'Appointment Date/Time',
                    size: 200,
                    Cell: ({ row }) => (
                        formatUnixTimestamp(row.original.appointmentStartTime)
                    )
                },
                {
                    accessorKey: 'display.airconBrand',
                    header: 'Aircon Model/Brand',
                    size: 150,
                    Cell: ({ row }) => (
                        row.original.display.airconBrand + "\n" +  row.original.display.airconModel
                    )
                },
                {
                    accessorKey: 'customerId',
                    header: 'Address',
                    size: 200,
                    Cell: ({ row }) => {
                        const customer = customerData[row.original.customerId];
                        return (
                            <Box
                            component="span"
                            sx={(theme) => ({
                                p: '0.25rem'
                            })}
                            >
                                {customer ? `${customer.address} S${customer.postalCode}` : 'Loading...'}
                            </Box>
                        );
                    }
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
                            row.original.appointmentStatus == 1 ? 
                            theme.palette.warning.main : row.original.appointmentStatus == 3
                            ? theme.palette.success.main : row.original.appointmentStatus == 2
                            ? theme.palette.primary.main : theme.palette.error.main,
                            borderRadius: '0.25rem',
                            color: '#fff',
                            maxWidth: '9ch',
                            p: '0.25rem'
                        })}
                        >
                            {displayApptStatus(row.original.appointmentStatus)}
                        </Box>
                    )
                }
            ]
        }
    ],
    [customerData, appointments])

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
        renderRowActionMenuItems: ({ closeMenu, row }) => {
            const customer = customerData[row.original.customerId];
            return [
                <MenuItem
                key={0}
                onClick={() => {
                    window.location.href='/technician/appointmentDetail?id=' + row.original.id
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
                    if (customer) {
                        openGoogleMaps(customer.address, customer.postalCode);
                    }
                    closeMenu();
                }}
                sx={{ m: 0 }}
                disabled={!customer}
                >
                    <ListItemIcon>
                        <LocationOn color={customer ? "primary" : "disabled"}/>
                    </ListItemIcon>
                    View Location
                </MenuItem>,
                row.original.appointmentStatus == 2 ?
                <MenuItem
                key={2}
                onClick={() => {
                    CompleteJob(row.original.id);
                    closeMenu();
                }}
                sx={{ m: 0 }}
                >
                    <ListItemIcon>
                        <EventAvailable/>
                    </ListItemIcon>
                    Complete Job
                </MenuItem> : null
            ];
        }
    })


// Move the return statement outside of useEffect
    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-semibold">Welcome Back, {localStorage.getItem('technicians_name')}</h1>
                    <h2 className="text-xl font-semibold mt-2">Upcoming Appointments</h2>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="default"
                        icon={<CalendarOutlined />}
                        onClick={() => setAvailabilityModalVisible(true)}
                        size="large"
                    >
                        Set Working Days
                    </Button>
                    <Button
                        type="primary"
                        icon={<MailOutlined />}
                        onClick={() => navigate('/technician/mailbox')}
                        size="large"
                    >
                        Mailbox
                    </Button>
                </div>
            </div>
            <MaterialReactTable table={apptTable}/>

            <TechnicianAvailabilityModal
                visible={availabilityModalVisible}
                onClose={() => setAvailabilityModalVisible(false)}
                technicianId={localStorage.getItem('technicians_id')}
            />
            {/* <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-800 text-white">
                    <tr>
                        <th className="w-1/5 px-4 py-2">Appointment Date/Time</th>
                        <th className="w-1/5 px-4 py-2">Aircon to be serviced</th>
                        <th className="w-1/5 px-4 py-2">Address</th>
                        <th className="w-1/5 px-4 py-2">Status</th>
                        <th className="w-1/5 px-4 py-2">Status</th>
                        <th className="w-1/5 px-4 py-2" colSpan={2}>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {appointments.map((appointment, index) => {
                        console.log("boom" + appointment.id)
                        // Show the row only if the appointment date is in the future
                        // if (appointmentDate > currentDate) {
                        return (
                            <tr key={appointment.id} className="text-center border-b">
                                <td className="px-4 py-2">{formatUnixTimestamp(appointment.appointmentStartTime)}</td>
                                <td>
                                    {appointment.display.airconBrand.map((brand, index) => (
                                        <div key={index} className="px-4 py-2">
                                            {brand},{appointment.display.airconModel[index]}
                                        </div>
                                    ))}
                                </td>
                                <td className="px-4 py-2">{addresses}</td>
                                <td className="px-4 py-2">
                                    {(() => {
                                        switch (appointment.appointmentStatus) {
                                            case "1":
                                                return "Upcoming";
                                            case "2":
                                                return "Ongoing";
                                            case "3":
                                                return "Completed";
                                            case "4":
                                                return "Cancelled";
                                            default:
                                                return "Unknown Status";
                                        }
                                    })()}
                                </td>
                                <td colSpan={2} className="px-4 py-2">
                                    <td className="px-4 py-2">
                                        {appointment.appointmentStatus === "1" ? (
                                            <button onClick={() => CheckIn(appointment.id)}
                                                    className="text-blue-500 hover:text-blue-600">
                                                Check In
                                            </button>
                                        ) : appointment.appointmentStatus === "2" ? (
                                            <button onClick={() => CompleteJob(appointment.id)}
                                                    className="text-green-500 hover:text-green-600">
                                                Complete Job
                                            </button>
                                        ) : null}
                                    </td>

                                    <td className="px-4 py-2">
                                        <Link to={`/appointmentDetail?id=${appointment.id}`}
                                              className="text-blue-500 hover:text-blue-600">
                                            View
                                        </Link>
                                    </td>
                                </td>
                            </tr>
                        );

                        // }
                        return null; // Don't render the row if the appointment date is in the past
                    })}

                    </tbody>
                </table>
            </div> */}
        </div>
    );
}

export default TechnicianHome;
