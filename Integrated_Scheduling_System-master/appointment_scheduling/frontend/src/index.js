import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter as Router, Routes, Route} from "react-router-dom";
import './index.css';
import Navbar from './components/navbar';
import CoordinatorNavbar from './components/CoordinatorNavbar';
import reportWebVitals from './reportWebVitals';
import Login from "./pages/Login";
import Home from "./pages/Home";
import Register from "./pages/Register";
import ScheduleAppointment from "./pages/ScheduleAppointment";
import Profile from "./pages/Profile";
import AppointmentDetail from "./pages/AppointmentDetail";
import RegisterTechnician from "./pages/RegisterTechnician";
import TechnicianList from "./pages/TechnicianList";
import CoordinatorHome from "./pages/CoordinatorHome";
import TechnicianLogin from './pages/TechnicianLogin';
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
// this will always be the last page
import Error404 from './pages/Error404';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    // <React.StrictMode>
    //   <App />
    // </React.StrictMode>
    <Router>
        <Navbar/>
        <CoordinatorNavbar/>
        <Routes>
            <Route path='/' element={<Login/>}/>
            <Route path='/login' element={<Login/>}/>
            <Route path='/TechnicianLogin' element={<TechnicianLogin/>}/>
            <Route path='/register' element={<Register/>}/>
            <Route path='/home' element={<Home/>}/>
            <Route path='/scheduleAppointment' element={<ScheduleAppointment/>}/>
            <Route path='/CustomerEnquiry' element={<CustomerEnquiry/>}/>
            <Route path='/profile' element={<Profile/>}/>
            <Route path='/appointmentDetail' element={<AppointmentDetail/>}/>
            <Route path='/RegisterTechnician' element={<RegisterTechnician/>}/>
            <Route path='/TechnicianList' element={<TechnicianList/>}/>
            <Route path='/TechnicianProfile' element={<TechnicianProfile/>}/>
            <Route path='/coordinatorHome' element={<CoordinatorHome/>}/>
            <Route path='/CoordinatorAppointmentView' element={<CoordinatorAppointmentView/>}/>
            <Route path='/CoordinatorAppointmentUpdate' element={<CoordinatorAppointmentUpdate/>}/>
            <Route path='/TechnicianHome' element={<TechnicianHome/>}/>
            <Route path='/rescheduleDetail' element={<RescheduleCoordinator/>}/>
            <Route path='/ReportIssues' element={<ReportIssues/>}/>
            <Route path='/mailbox' element={<Mailbox/>}/>
            <Route path='/TechnicianHiring' element={<TechnicianHiring/>}/>
            <Route path='/guest-booking' element={<GuestBooking/>}/>
            <Route path='/error' element={<Error404/>}/>
            <Route path='*' element={<Error404/>}/>
        </Routes>
    </Router>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();