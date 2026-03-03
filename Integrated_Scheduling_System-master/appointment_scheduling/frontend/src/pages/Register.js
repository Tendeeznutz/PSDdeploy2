import { Input, Button, Typography } from '@material-tailwind/react';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from "../axiosConfig";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import backgroundImage from '../asset/img/air_servicing.png'; // replace this with your actual background image path

const Register = () => {
  const [customerObject, setCustomerObject] = useState({
    customerName: '',
    customerPostalCode: '',
    customerAddress: '',
    customerPhone: '',
    customerEmail: '',
    customerPassword: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const navigate = useNavigate();

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setCustomerObject({ ...customerObject, customerEmail: newEmail });

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        setEmailError('Please enter a valid email address');
        setIsSubmitDisabled(true);
      } else {
        setEmailError('');
        setIsSubmitDisabled(false);
      }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    // Singapore phone number validation (8 digits, optional starting with 6, 8, or 9)
    const phoneRegex = /^(6|8|9)\d{7}$/;
    if (!phoneRegex.test(customerObject.customerPhone)) {
      setErrorMessage('Please enter a valid Singapore phone number');
      return;
    }

    if (customerObject.customerPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    try {
      const response = await api.post(`/api/customers/`, {
        customerName: customerObject.customerName,
        customerAddress: customerObject.customerAddress,
        customerPhone: customerObject.customerPhone,
        customerPassword: customerObject.customerPassword,
        customerEmail: customerObject.customerEmail,
        customerPostalCode: customerObject.customerPostalCode,
      });

      // Check the status code
      if (response.status === 201) {
        // Successful registration
        navigate('/login');
      } else {
        // Registration failed
        console.error('Registration failed:', response.data);
        // log error message
        console.error('Error Message:', response.data.message);
        setErrorMessage('Registration failed. Please try again.');
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        // Extract and log the specific error message
        const errorMessage = error.response.data.error;
        console.error('Registration failed:', errorMessage);
        setErrorMessage(`Registration failed: ${errorMessage}. Please try again.`);
      } else {
        // Handle other network errors or exceptions
        console.error('Registration failed:', error);
        setErrorMessage('Registration failed. Please try again.');
      }
    }
  };

  return (
    <section className="m-8 flex">
      <div className="w-2/5 h-full hidden lg:block">
        <img
          src={backgroundImage}
          className="h-full w-full object-cover rounded-3xl"
        />
      </div>
      <div className="w-full lg:w-3/5 flex flex-col items-center justify-center">
        <div className="text-center">
          <Typography variant="h2" className="font-bold mb-1">Register</Typography>
          <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">Please fill in your details to register.</Typography>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2">
          <div className="mb-3 flex flex-col gap-6 w-full">
            <Typography variant="small" color="blue-gray" className="-mb-5 font-bold">
              Name
            </Typography>
            <Input
              placeholder="Full Name"
              className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
              value={customerObject.customerName}
              onChange={(e) => setCustomerObject({ ...customerObject, customerName: e.target.value })}
            />
          </div>
          <div className="mb-3 flex flex-row gap-2 w-full">
            <div className="lg:w-5/6">
              <Typography variant="small" color="blue-gray" className="mb-1 font-bold">
                Address
              </Typography>
              <Input
                placeholder="Address"
                className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                labelProps={{
                  className: "before:content-none after:content-none",
                }}
                value={customerObject.customerAddress}
                onChange={(e) => setCustomerObject({ ...customerObject, customerAddress: e.target.value })}
              />
            </div>
            <div className="">
              <Typography variant="small" color="blue-gray" className="mb-1 font-bold">
                Postal Code
              </Typography>
              <Input
                placeholder="Postal Code"
                className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                labelProps={{
                  className: "before:content-none after:content-none",
                }}
                value={customerObject.customerPostalCode}
                onChange={(e) => setCustomerObject({ ...customerObject, customerPostalCode: e.target.value })}
              />
            </div>
          </div>
          <div className="mb-3 flex flex-col gap-2">
            <Typography variant="small" color="blue-gray" className="mb-1 font-bold">
              Phone
            </Typography>
            <div className="relative flex flex-row w-full">
              <Button
                ripple={false}
                variant="text"
                color="blue-gray"
                className="flex h-10 items-center gap-2 rounded-r-none border border-r-0 border-blue-gray-200 bg-blue-gray-500/10 pl-3"
                disabled
              >
                +65
              </Button>
              <div className="w-full">
                <Input
                  type="tel"
                  placeholder="Mobile Number"
                  className="rounded-l-none !border-t-blue-gray-200 focus:!border-t-gray-900"
                  labelProps={{
                    className: "before:content-none after:content-none",
                  }}
                  value={customerObject.customerPhone}
                  onChange={(e) => setCustomerObject({ ...customerObject, customerPhone: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="mb-3 flex flex-col gap-6 w-full">
            <Typography variant="small" color="blue-gray" className="-mb-5 font-bold">
              Email
            </Typography>
            <Input
              type="email"
              placeholder="name@mail.com"
              className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
              value={customerObject.customerEmail}
              onChange={handleEmailChange}
            />
            {emailError !== '' && <p className="text-sm text-red-500">{emailError}</p>}
          </div>
          <div className="mb-3 flex flex-col gap-6 w-full">
            <Typography variant="small" color="blue-gray" className="-mb-5 font-bold">
              Password
            </Typography>
            <Input
              type="password"
              placeholder="********"
              className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
              value={customerObject.customerPassword}
              onChange={(e) => setCustomerObject({ ...customerObject, customerPassword: e.target.value })}
            />
          </div>
          <div className="mb-3 flex flex-col gap-6 w-full">
            <Typography variant="small" color="blue-gray" className="-mb-5 font-bold">
              Confirm Password
            </Typography>
            <Input
              type="password"
              placeholder="********"
              className=" border-t-blue-gray-200 focus:border-t-gray-900"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPassword !== '' && confirmPassword !== customerObject.customerPassword}
              success={confirmPassword !== '' && confirmPassword === customerObject.customerPassword}
            />
          </div>
          <span>
            {confirmPassword === '' && <p className="text-sm">&nbsp;</p>}
              {confirmPassword !== '' && confirmPassword !== customerObject.customerPassword && (
                <p className="text-sm text-red-500">
                  <FontAwesomeIcon icon={faTimes} /> Passwords do not match
                </p>
              )}
              {confirmPassword !== '' && confirmPassword === customerObject.customerPassword && (
                <p className="text-sm text-green-500">
                  <FontAwesomeIcon icon={faCheck} /> Password match
                </p>
              )}
          </span>
          {errorMessage && <div className="mb-4 text-sm text-red-500">{errorMessage}</div>}
          <Button
            className="mt-6"
            fullWidth
            type="submit"
            disabled={isSubmitDisabled}
          >
            Register
          </Button>
          <Typography variant="paragraph" className="text-center text-blue-gray-500 font-medium mt-4">
            Already have an account?
            <Link to="/" className="text-gray-900 ml-1">Sign in</Link>
          </Typography>
        </form>
      </div>
    </section>
    );
};

export default Register;
