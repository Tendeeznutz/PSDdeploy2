import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Input, Button as MTButton, Typography, Select, Option } from '@material-tailwind/react';
import { DatePicker, TimePicker, message, Radio, InputNumber, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import backgroundImage from '../asset/img/air_servicing.png';

const GuestBooking = () => {
  const [bookingData, setBookingData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    customerPostalCode: '',
    paymentMethod: 'cash',
  });

  const [airconDevices, setAirconDevices] = useState([
    { brand: '', model: '', units: 1 }
  ]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const airconBrands = [
    'Daikin', 'Mitsubishi', 'Panasonic', 'LG', 'Samsung',
    'Fujitsu', 'Sharp', 'Toshiba', 'Hitachi', 'York', 'Other'
  ];

  // Device management functions
  const addDevice = () => {
    setAirconDevices([...airconDevices, { brand: '', model: '', units: 1 }]);
  };

  const removeDevice = (index) => {
    if (airconDevices.length > 1) {
      setAirconDevices(airconDevices.filter((_, i) => i !== index));
    }
  };

  const updateDevice = (index, field, value) => {
    const updated = [...airconDevices];
    updated[index] = { ...updated[index], [field]: value };
    setAirconDevices(updated);
  };

  // Cost calculation
  const totalUnits = airconDevices.reduce((sum, d) => sum + d.units, 0);
  const serviceFee = totalUnits * 50;
  const travelFee = 10;
  const totalCost = serviceFee + travelFee;

  const handleInputChange = (field, value) => {
    setBookingData({ ...bookingData, [field]: value });
    setErrorMessage('');
  };

  const validateForm = () => {
    const { customerName, customerPhone, customerEmail, customerAddress, customerPostalCode } = bookingData;

    if (!customerName || !customerPhone || !customerEmail || !customerAddress || !customerPostalCode) {
      setErrorMessage('Please fill in all required fields');
      return false;
    }

    // Check each device has a brand selected
    for (let i = 0; i < airconDevices.length; i++) {
      if (!airconDevices[i].brand) {
        setErrorMessage(`Please select a brand for AC Unit ${i + 1}`);
        return false;
      }
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
        appointmentStartTime: appointmentTimestamp,
        paymentMethod: bookingData.paymentMethod,
        airconDevices: airconDevices.map(d => ({
          brand: d.brand,
          model: d.model || 'Standard',
          units: d.units,
        })),
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
          paymentMethod: 'cash',
        });
        setAirconDevices([{ brand: '', model: '', units: 1 }]);
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

            {/* AC Devices Section */}
            <Typography variant="h6" color="blue-gray" className="font-semibold">
              Aircon Units
            </Typography>

            {airconDevices.map((device, index) => (
              <div
                key={index}
                className="border border-gray-300 rounded-lg p-4 relative"
              >
                <div className="flex justify-between items-center mb-3">
                  <Typography variant="small" color="blue-gray" className="font-semibold">
                    AC Unit {index + 1}
                  </Typography>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={airconDevices.length <= 1}
                    onClick={() => removeDevice(index)}
                  >
                    Remove
                  </Button>
                </div>

                <div className="flex flex-col gap-4">
                  <Typography variant="small" color="blue-gray" className="-mb-2 font-medium">
                    Brand *
                  </Typography>
                  <Select
                    size="lg"
                    value={device.brand}
                    onChange={(value) => updateDevice(index, 'brand', value)}
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

                  <Typography variant="small" color="blue-gray" className="-mb-2 font-medium">
                    Model (Optional)
                  </Typography>
                  <Input
                    size="lg"
                    placeholder="e.g., Inverter 1.5HP"
                    value={device.model}
                    onChange={(e) => updateDevice(index, 'model', e.target.value)}
                    className="!border-t-blue-gray-200 focus:!border-t-gray-900"
                    labelProps={{
                      className: "before:content-none after:content-none",
                    }}
                  />

                  <Typography variant="small" color="blue-gray" className="-mb-2 font-medium">
                    Number of Units *
                  </Typography>
                  <InputNumber
                    size="large"
                    min={1}
                    max={10}
                    value={device.units}
                    onChange={(value) => updateDevice(index, 'units', value || 1)}
                    className="w-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            ))}

            <Button
              type="dashed"
              onClick={addDevice}
              block
              icon={<PlusOutlined />}
            >
              Add Another AC Unit
            </Button>

            <Typography variant="small" color="blue-gray" className="text-center font-medium">
              Total: {totalUnits} unit(s) across {airconDevices.length} device(s)
            </Typography>

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
              placeholder="Select time (09:00 - 18:00)"
              minuteStep={30}
              disabledHours={() => [0,1,2,3,4,5,6,7,8,19,20,21,22,23]}
              hideDisabledOptions
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
                Service Fee ({totalUnits} unit{totalUnits > 1 ? 's' : ''} x $50): ${serviceFee.toFixed(2)}
              </Typography>
              <Typography variant="small" color="blue-gray">
                Travel Fee: ${travelFee.toFixed(2)}
              </Typography>
              <Typography variant="small" color="blue-gray" className="font-bold mt-2">
                Total: ${totalCost.toFixed(2)}
              </Typography>
            </div>
          </div>

          {errorMessage && (
            <Typography variant="small" color="red" className="mt-4 text-center font-medium">
              {errorMessage}
            </Typography>
          )}

          <MTButton
            className="mt-6"
            fullWidth
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating Booking...' : 'Book Appointment'}
          </MTButton>

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
