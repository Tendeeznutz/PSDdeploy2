import React, {useState, useEffect, useMemo} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import axios from 'axios';
import { Box, ListItem, ListItemIcon, MenuItem } from '@mui/material';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { EventAvailable, PageviewRounded, PunchClock } from '@mui/icons-material';
import { Button } from 'antd';
import { MailOutlined } from '@ant-design/icons';

// ...

function TechnicianHome() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [appointmentStatuses, setAppointmentStatuses] = useState([]);


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
        console.log("Check in for appointment: " + appointmentId);
        axios.put(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/${appointmentId}/`, {
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
        axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/technicians/?technicianId=` + localStorage.getItem("technicians_id"))
            .then(response => {
                    console.log(response.data);
                    localStorage.setItem("technicians_phone", response.data[0].phone);
                    localStorage.setItem("technicians_email", response.data[0].email);
                    localStorage.setItem("technicians_name", response.data[0].technicianName);
                }
            )
            .catch(error => {
                    console.error('There was an error!', error);
                }
            );
        console.log("Technician Phone in dashboard page: " + localStorage.getItem("technicians_id"));
        axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/appointments/?technicianId=${localStorage.getItem("technicians_id")}`)
            .then(response => {
                setAppointments(response.data);
                console.log("Number of appointments: ", response.data);

                if (response.data.length > 0) {
                    const customerId = response.data[0].customerId;

                    axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/customers/${customerId}/`)
                        .then(customerResponse => {
                            console.log("Customer response: " + customerResponse.data.customerAddress);
                            setAddresses(customerResponse.data.customerAddress);
                        })
                        .catch(customerError => {
                            console.error('Error fetching customer details:', customerError);
                        });
                }
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
                    accessorKey: 'id',
                    header: 'Address',
                    size: 150,
                    Cell: ({ row }) => (
                        <Box
                        component="span"
                        sx={(theme) => ({
                            p: '0.25rem'
                        })}
                        >
                            {addresses}
                        </Box>
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
    [addresses, appointments])

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
                window.location.href='/appointmentDetail?id=' + row.original.id
                closeMenu();
            }}
            sx={{ m: 0 }}
            >
                <ListItemIcon>
                    <PageviewRounded/>
                </ListItemIcon>
                View
            </MenuItem>,
            row.original.appointmentStatus == 2 ? 
            <MenuItem
            key={1}
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
            // row.original.appointmentStatus == 1 ? 
            // <MenuItem
            // key={1}
            // onClick={() => {
            //     CheckIn(row.original.id);
            //     closeMenu();
            // }}
            // sx={{ m: 0 }}
            // >
            //     <ListItemIcon>
            //         <PunchClock/>
            //     </ListItemIcon>
            //     Check In
            // </MenuItem> : null
        ]
    })


// Move the return statement outside of useEffect
    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-semibold">Welcome Back, {localStorage.getItem('technicians_name')}</h1>
                    <h2 className="text-xl font-semibold mt-2">Upcoming Appointments</h2>
                </div>
                <Button
                    type="primary"
                    icon={<MailOutlined />}
                    onClick={() => navigate('/mailbox')}
                    size="large"
                >
                    Mailbox
                </Button>
            </div>
            <MaterialReactTable table={apptTable}/>
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
