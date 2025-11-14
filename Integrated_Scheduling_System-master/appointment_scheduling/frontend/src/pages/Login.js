import React, { useState } from 'react';
import { Input, Button, Typography, Select, Option } from "@material-tailwind/react";
import { Link, useNavigate } from 'react-router-dom';
import axios from "axios";
import backgroundImage from '../asset/img/air_servicing.png'; // replace this with your actual background image path

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedUserType, setSelectedUserType] = useState('customers');
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        console.log('Login Details:', { email, password });
        // log backend URL
        console.log('Backend URL:', process.env.REACT_APP_BACKEND_URL);
        // Set the endpoint based on the selected user type
        const endpoint = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/${selectedUserType}/login/`;

        try {
            const response = await axios.post(endpoint, {
                email,
                password
            });

            localStorage.removeItem('customers_id');
            localStorage.removeItem('customers_name');
            localStorage.removeItem('technicians_id');
            localStorage.removeItem('technicians_name');
            localStorage.removeItem('technicians_phone');
            localStorage.removeItem('coordinators_id');
            localStorage.removeItem('coordinators_email');
            localStorage.removeItem('coordinators_name');

            console.log('Login successful:', response.data);
            if (response.status === 200) {
              if (selectedUserType == 'customers') {
                localStorage.setItem(`${selectedUserType}_id`, response.data.customer_id);
                localStorage.setItem(`${selectedUserType}_name`, response.data.customerName);
                navigate('/home');
              } else if (selectedUserType == 'technicians') {
                localStorage.setItem(`${selectedUserType}_phone`, response.data.technician_phone);
                localStorage.setItem(`${selectedUserType}_id`, response.data.technician_id);
                localStorage.setItem(`${selectedUserType}_name`, response.data.technicianName);
                navigate('/TechnicianHome');
              } else {
                localStorage.setItem(`${selectedUserType}_id`, response.data.coordinator_id);
                localStorage.setItem(`${selectedUserType}_email`, response.data.coordinatorEmail);
                localStorage.setItem(`${selectedUserType}_name`, response.data.coordinatorName);
                navigate('/coordinatorHome');
              }
            }
        } catch (error) {
            console.error('Login failed:', error);
            setErrorMessage('Login failed. Please try again.');
        }
    };

    const renderEmailField = () => {
        if (selectedUserType === 'technicians') {
            return (
              <>
                <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                  Phone
                </Typography>
                <Input
                  id="technicianPhone"
                  type="tel"
                  placeholder="1234 5678"
                  className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                  labelProps={{
                    className: "before:content-none after:content-none",
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            );
        } else {
            return (
                <>
                  <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                    Email
                  </Typography>
                  <Input
                    id="customerEmail"
                    placeholder="name@mail.com"
                    className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                    labelProps={{
                      className: "before:content-none after:content-none",
                    }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
              </>
            );
        }
    };

    return (
      <section className="m-8 flex gap-4">
        <div className="w-full lg:w-3/5 mt-24">
          <div className="text-center">
            <Typography variant="h2" className="font-bold mb-4">Login</Typography>
            <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">Please fill in your credentials to login.</Typography>
          </div>
          <form onSubmit={handleSubmit} className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2">
            <div className="mb-4 flex flex-col gap-6">
              <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                User Type
              </Typography>
              <Select
                className="!border-t-blue-gray-200 focus:!border-t-gray-900"
                id="userType"
                onChange={(e) => setSelectedUserType(e)}
                value={selectedUserType}
                labelProps={{
                  className: "before:content-none after:content-none",
                }}
                menuProps={{ className: "h-48" }}
              >
                <Option value="customers">Customer</Option>
                <Option value="technicians">Technician</Option>
                <Option value="coordinators">Coordinator</Option>
              </Select>
            </div>
            <div className="mb-1 flex flex-col gap-6">
              {renderEmailField()}
              <Typography variant="small" color="blue-gray" className="-mb-3 font-bold">
                Password
              </Typography>
              <Input
                type="password"
                size="lg"
                placeholder="********"
                className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                labelProps={{
                  className: "before:content-none after:content-none",
                }}
              />
            </div>
            <p className="text-xs italic text-red-500">{errorMessage}</p>
            <Button className="mt-6" fullWidth type='submit'>
              Sign In
            </Button>

            {/* <div className="flex items-center justify-between gap-2 mt-6">
              <Typography variant="small" className="font-medium text-gray-900">
                <a href="#">
                  Forgot Password
                </a>
              </Typography>
            </div> */}
            {selectedUserType === 'customers' && (
              <Typography variant="paragraph" className="text-center text-blue-gray-500 font-medium mt-4">
                Not registered?
                <Link to="/register" className="text-gray-900 ml-1">Create account</Link>
              </Typography>
            )}
            
          </form>

        </div>
        <div className="w-2/5 h-full hidden lg:block">
          <img
            src={backgroundImage}
            className="h-full w-full object-cover rounded-3xl"
          />
        </div>

      </section>
    );
}

export default Login;
