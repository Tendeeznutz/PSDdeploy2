import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import './index.css';
import Navbar from './components/navbar';
import CoordinatorNavbar from './components/CoordinatorNavbar';
import InactivityTimer from './components/InactivityTimer';
import reportWebVitals from './reportWebVitals';
import Login from "./pages/Login";
import Home from "./pages/Home";
import Register from "./pages/Register";
import ApplyTechnician from "./pages/ApplyTechnician";
import ScheduleAppointment from "./pages/ScheduleAppointment";
import Profile from "./pages/Profile";
import AppointmentDetail from "./pages/AppointmentDetail";
import RegisterTechnician from "./pages/RegisterTechnician";
import TechnicianList from "./pages/TechnicianList";
import CoordinatorHome from "./pages/CoordinatorHome";
import TechnicianHome from "./pages/TechnicianHome";
import RescheduleCoordinator from './pages/RescheduleCoordinator';
import CoordinatorAppointmentView from './pages/CoordinatorAppointmentView';
import CustomerEnquiry from './pages/CustomerEnquiry';
import TechnicianProfile from './pages/TechnicianProfile';
import CoordinatorAppointmentUpdate from "./pages/CoordinatorAppointmentUpdate";
import ReportIssues from './pages/ReportIssues';
import Mailbox from './pages/Mailbox';
import TechnicianHiring from './pages/TechnicianHiring';
import GuestBooking from './pages/GuestBooking';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Error404 from './pages/Error404';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <Router>
        <Navbar/>
        <CoordinatorNavbar/>
        <InactivityTimer/>
        <Routes>
            <Route path='/' element={<Navigate to="/login" replace />}/>
            <Route path='/login' element={<Login/>}/>
            <Route path='/login/customer' element={<Login/>}/>
            <Route path='/login/technician' element={<Login/>}/>
            <Route path='/login/coordinator' element={<Login/>}/>
            <Route path='/TechnicianLogin' element={<Navigate to="/login/technician" replace />}/>
            <Route path='/register' element={<Register/>}/>
            <Route path='/apply-technician' element={<ApplyTechnician/>}/>
            <Route path='/forgot-password' element={<ForgotPassword/>}/>
            <Route path='/reset-password' element={<ResetPassword/>}/>

            <Route path='/customer/home' element={<Home/>}/>
            <Route path='/customer/scheduleAppointment' element={<ScheduleAppointment/>}/>
            <Route path='/customer/profile' element={<Profile/>}/>
            <Route path='/customer/appointmentDetail' element={<AppointmentDetail/>}/>
            <Route path='/customer/ReportIssues' element={<ReportIssues/>}/>
            <Route path='/customer/mailbox' element={<Mailbox/>}/>

            <Route path='/technician/home' element={<TechnicianHome/>}/>
            <Route path='/technician/profile' element={<TechnicianProfile/>}/>
            <Route path='/technician/appointmentDetail' element={<AppointmentDetail/>}/>
            <Route path='/technician/mailbox' element={<Mailbox/>}/>

            <Route path='/coordinator/home' element={<CoordinatorHome/>}/>
            <Route path='/coordinator/technicianHiring' element={<TechnicianHiring/>}/>
            <Route path='/coordinator/registerTechnician' element={<RegisterTechnician/>}/>
            <Route path='/coordinator/appointmentView' element={<CoordinatorAppointmentView/>}/>
            <Route path='/coordinator/appointmentUpdate' element={<CoordinatorAppointmentUpdate/>}/>
            <Route path='/coordinator/customerEnquiry' element={<CustomerEnquiry/>}/>
            <Route path='/coordinator/mailbox' element={<Mailbox/>}/>
            <Route path='/coordinator/rescheduleDetail' element={<RescheduleCoordinator/>}/>

            <Route path='/CustomerEnquiry' element={<CustomerEnquiry/>}/>
            <Route path='/TechnicianList' element={<TechnicianList/>}/>
            <Route path='/guest-booking' element={<GuestBooking/>}/>
            <Route path='/error' element={<Error404/>}/>
            <Route path='*' element={<Error404/>}/>
        </Routes>
    </Router>
);

reportWebVitals();
