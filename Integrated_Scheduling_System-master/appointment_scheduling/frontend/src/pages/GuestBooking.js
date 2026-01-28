import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Input, Button, Typography, Select, Option, Textarea } from '@material-tailwind/react';
import { DatePicker, TimePicker, message, Radio } from 'antd';
import dayjs from 'dayjs';
import backgroundImage from '../asset/img/air_servicing.png';

const GuestBooking = () => {
  const [bookingData, setBookingData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    customerPostalCode: '',
    airconBrand: '',
    airconModel: '',
    paymentMethod: 'cash',
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const airconBrands = [
    'Daikin', 'Mitsubishi', 'Panasonic', 'LG', 'Samsung',
    'Fujitsu', 'Sharp', 'Toshiba', 'Hitachi', 'York', 'Other'
  ];

  const handleInputChange = (field, value) => {
    setBookingData({ ...bookingData, [field]: value });
    setErrorMessage('');
  };

  const validateForm = () => {
    const { customerName, customerPhone, customerEmail, customerAddress, customerPostalCode, airconBrand } = bookingData;

    if (!customerName || !customerPhone || !customerEmail || !customerAddress || !customerPostalCode || !airconBrand) {
      setErrorMessage('Please fill in all required fields');
      return false;
    }

    // Singapore phone number validation
    const phoneRegex = /^(6|8|9)\d{7}$/;
    if (!phoneRegex.test(customerPhone)) {
      setErrorMessage('Please enter a valid Singapore phone number (8 digits starting with 6, 8, or 9)');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }

    // Postal code validation (6 digits)
    const postalRegex = /^\d{6}$/;
    if (!postalRegex.test(customerPostalCode)) {
      setErrorMessage('Please enter a valid Singapore postal code (6 digits)');
      return false;
    }

    if (!selectedDate || !selectedTime) {
      setErrorMessage('Please select appointment date and time');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Combine date and time into Unix timestamp
      const dateTimeString = `${selectedDate.format('YYYY-MM-DD')} ${selectedTime.format('HH:mm')}`;
      const appointmentTimestamp = dayjs(dateTimeString).unix();

      const payload = {
        customerName: bookingData.customerName,
        customerPhone: bookingData.customerPhone,
        customerEmail: bookingData.customerEmail,
        customerAddress: bookingData.customerAddress,
        customerPostalCode: bookingData.customerPostalCode,
        airconBrand: bookingData.airconBrand,
        airconModel: bookingData.airconModel || 'Standard',
        appointmentStartTime: appointmentTimestamp,
        paymentMethod: bookingData.paymentMethod,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/appointments/guest-booking/`,
        payload
      );

      if (response.status === 201) {
        message.success('Booking created successfully! Check your email for confirmation.');

        // Show success message with booking details
        const bookingRef = response.data.appointment?.id?.substring(0, 8).toUpperCase();
        message.info(`Your booking reference is: ${bookingRef}`, 5);

        // Clear form
        setBookingData({
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          customerAddress: '',
          customerPostalCode: '',
          airconBrand: '',
          airconModel: '',
          paymentMethod: 'cash',
        });
        setSelectedDate(null);
        setSelectedTime(null);

        // Redirect after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (error) {
      console.error('Booking failed:', error);
      if (error.response?.data?.error) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage('Failed to create booking. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Disable past dates
  const disabledDate = (current) => {
    return current && current < dayjs().startOf('day');
  };

  return (
    <section className="m-8 flex">
      <div className="w-2/5 h-full hidden lg:block">
        <img
          src={backgroundImage}
          className="h-full w-full object-cover rounded-3xl"
          alt="Air Servicing"
        />
      </div>
      <div className="w-full lg:w-3/5 flex flex-col items-center justify-center">
        <div className="text-center">
          <Typography variant="h2" className="font-bold mb-1">Quick Booking</Typography>
          <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">
            Book an appointment without creating an account
          </Typography>
        </div>
        <form className="mt-8 mb-2 mx-auto w-80 max-w-screen-lg lg:w-1/2" onSubmit={handleSubmit}>
          <div className="mb-1 flex flex-col gap-6">
            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Your Name *
            </Typography>
            <Input
              size="lg"
              placeholder="John Doe"
              value={bookingData.customerName}
              onChange={(e) => handleInputChange('customerName', e.target.value)}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Phone Number *
            </Typography>
            <Input
              size="lg"
              placeholder="91234567"
              value={bookingData.customerPhone}
              onChange={(e) => handleInputChange('customerPhone', e.target.value)}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Email Address *
            </Typography>
            <Input
              size="lg"
              placeholder="name@mail.com"
              type="email"
              value={bookingData.customerEmail}
              onChange={(e) => handleInputChange('customerEmail', e.target.value)}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Address *
            </Typography>
            <Input
              size="lg"
              placeholder="123 Main Street #01-01"
              value={bookingData.customerAddress}
              onChange={(e) => handleInputChange('customerAddress', e.target.value)}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Postal Code *
            </Typography>
            <Input
              size="lg"
              placeholder="123456"
              value={bookingData.customerPostalCode}
              onChange={(e) => handleInputChange('customerPostalCode', e.target.value)}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Aircon Brand *
            </Typography>
            <Select
              size="lg"
              value={bookingData.airconBrand}
              onChange={(value) => handleInputChange('airconBrand', value)}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
            >
              {airconBrands.map((brand) => (
                <Option key={brand} value={brand}>
                  {brand}
                </Option>
              ))}
            </Select>

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Aircon Model (Optional)
            </Typography>
            <Input
              size="lg"
              placeholder="e.g., Inverter 1.5HP"
              value={bookingData.airconModel}
              onChange={(e) => handleInputChange('airconModel', e.target.value)}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: "before:content-none after:content-none",
              }}
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Preferred Date *
            </Typography>
            <DatePicker
              size="large"
              value={selectedDate}
              onChange={setSelectedDate}
              disabledDate={disabledDate}
              format="YYYY-MM-DD"
              className="w-full"
              placeholder="Select date"
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Preferred Time *
            </Typography>
            <TimePicker
              size="large"
              value={selectedTime}
              onChange={setSelectedTime}
              format="HH:mm"
              className="w-full"
              placeholder="Select time"
              minuteStep={30}
            />

            <Typography variant="small" color="blue-gray" className="-mb-3 font-medium">
              Payment Method *
            </Typography>
            <Radio.Group
              value={bookingData.paymentMethod}
              onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
              className="flex flex-col gap-2"
            >
              <Radio value="cash">Cash</Radio>
              <Radio value="card">Credit/Debit Card</Radio>
              <Radio value="paynow">PayLah/PayNow</Radio>
              <Radio value="bank_transfer">Bank Transfer</Radio>
            </Radio.Group>

            <div className="bg-blue-50 p-4 rounded-lg">
              <Typography variant="small" color="blue-gray" className="font-semibold mb-2">
                Cost Breakdown:
              </Typography>
              <Typography variant="small" color="blue-gray">
                Service Fee (1 aircon): $50.00
              </Typography>
              <Typography variant="small" color="blue-gray">
                Travel Fee: $10.00
              </Typography>
              <Typography variant="small" color="blue-gray" className="font-bold mt-2">
                Total: $60.00
              </Typography>
            </div>
          </div>

          {errorMessage && (
            <Typography variant="small" color="red" className="mt-4 text-center font-medium">
              {errorMessage}
            </Typography>
          )}

          <Button
            className="mt-6"
            fullWidth
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating Booking...' : 'Book Appointment'}
          </Button>

          <Typography variant="paragraph" className="text-center text-blue-gray-500 font-medium mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-gray-900 ml-1">Sign in</a>
          </Typography>
        </form>
      </div>
    </section>
  );
};

export default GuestBooking;
