import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Upload, message, Select, Card, Space } from 'antd';
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { TextArea } = Input;
const { Option } = Select;

function PersonalDetailsForm({ applicationData, updateApplicationData, moveToNextTab }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);
    const [fileList, setFileList] = useState([]);
    const navigate = useNavigate();

    const handleFileChange = ({ fileList: newFileList }) => {
        setFileList(newFileList);
        if (newFileList.length > 0) {
            const file = newFileList[0].originFileObj;
            updateApplicationData({
                resumeFile: file,
                resumeFileName: file.name
            });
        }
    };

    const handleSubmit = async (values) => {
        if (!confirmChecked) {
            message.error('Please confirm that all information is correct');
            return;
        }

        setLoading(true);
        try {
            const formData = {
                applicantName: values.applicantName,
                nric: values.nric,
                citizenship: values.citizenship,
                applicantAddress: values.applicantAddress,
                applicantPostalCode: values.applicantPostalCode,
                applicantPhone: values.applicantPhone,
                applicantEmail: values.applicantEmail,
                workExperience: values.workExperience,
                resumeFileName: applicationData.resumeFileName,
                hasCriminalRecord: values.hasCriminalRecord,
                criminalRecordDetails: values.hasCriminalRecord ? values.criminalRecordDetails : '',
                personalDetailsConfirmed: true
            };

            // Create the application
            const response = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/hiring-applications/`,
                formData
            );

            message.success('Personal details submitted successfully!');

            // Update application data with the response
            updateApplicationData({
                ...formData,
                id: response.data.id,
                applicationStatus: 'personal_details'
            });

            // Confirm personal details to move to next stage
            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/hiring-applications/${response.data.id}/confirm-personal-details/`
            );

            updateApplicationData({ personalDetailsConfirmed: true, applicationStatus: 'bank_info' });
            moveToNextTab();

        } catch (error) {
            console.error('Error submitting personal details:', error);
            message.error(error.response?.data?.nric?.[0] || 'Failed to submit personal details. Please check all fields.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="Step 1: Personal Details and Qualifications" className="mt-4">
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                    hasCriminalRecord: false
                }}
            >
                <Form.Item
                    label="Full Name"
                    name="applicantName"
                    rules={[{ required: true, message: 'Please enter full name' }]}
                >
                    <Input placeholder="Enter full name" size="large" />
                </Form.Item>

                <Form.Item
                    label="NRIC"
                    name="nric"
                    rules={[
                        { required: true, message: 'Please enter NRIC' },
                        { pattern: /^[STFG]\d{7}[A-Z]$/, message: 'Invalid NRIC format (e.g., S1234567A)' }
                    ]}
                >
                    <Input placeholder="e.g., S1234567A" size="large" />
                </Form.Item>

                <Form.Item
                    label="Citizenship"
                    name="citizenship"
                    rules={[{ required: true, message: 'Please select citizenship' }]}
                >
                    <Select placeholder="Select citizenship" size="large">
                        <Option value="Singapore Citizen">Singapore Citizen</Option>
                        <Option value="Permanent Resident">Permanent Resident</Option>
                        <Option value="Work Permit">Work Permit</Option>
                        <Option value="Employment Pass">Employment Pass</Option>
                        <Option value="Other">Other</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    label="Residential Address"
                    name="applicantAddress"
                    rules={[{ required: true, message: 'Please enter address' }]}
                >
                    <Input placeholder="Enter full address" size="large" />
                </Form.Item>

                <Form.Item
                    label="Postal Code"
                    name="applicantPostalCode"
                    rules={[
                        { required: true, message: 'Please enter postal code' },
                        { pattern: /^\d{6}$/, message: 'Postal code must be 6 digits' }
                    ]}
                >
                    <Input placeholder="e.g., 123456" size="large" maxLength={6} />
                </Form.Item>

                <Form.Item
                    label="Phone Number"
                    name="applicantPhone"
                    rules={[
                        { required: true, message: 'Please enter phone number' },
                        { pattern: /^\d{8}$/, message: 'Phone number must be 8 digits' }
                    ]}
                >
                    <Input placeholder="e.g., 91234567" size="large" maxLength={8} />
                </Form.Item>

                <Form.Item
                    label="Email Address"
                    name="applicantEmail"
                    rules={[
                        { required: true, message: 'Please enter email' },
                        { type: 'email', message: 'Please enter a valid email' }
                    ]}
                >
                    <Input placeholder="email@example.com" size="large" />
                </Form.Item>

                <Form.Item
                    label="Work Experience"
                    name="workExperience"
                    rules={[{ required: true, message: 'Please describe your work experience' }]}
                >
                    <TextArea
                        rows={6}
                        placeholder="Describe your relevant work experience, skills, and qualifications..."
                        maxLength={2000}
                        showCount
                    />
                </Form.Item>

                <Form.Item
                    label="Resume Upload"
                    name="resumeFile"
                >
                    <Upload
                        beforeUpload={() => false}
                        onChange={handleFileChange}
                        fileList={fileList}
                        maxCount={1}
                        accept=".pdf,.doc,.docx"
                    >
                        <Button icon={<UploadOutlined />} size="large">
                            Click to Upload Resume (PDF/DOC)
                        </Button>
                    </Upload>
                </Form.Item>

                <Form.Item
                    name="hasCriminalRecord"
                    valuePropName="checked"
                >
                    <Checkbox>I have a criminal record to declare</Checkbox>
                </Form.Item>

                <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                        prevValues.hasCriminalRecord !== currentValues.hasCriminalRecord
                    }
                >
                    {({ getFieldValue }) =>
                        getFieldValue('hasCriminalRecord') ? (
                            <Form.Item
                                label="Criminal Record Details"
                                name="criminalRecordDetails"
                                rules={[{ required: true, message: 'Please provide details' }]}
                            >
                                <TextArea
                                    rows={4}
                                    placeholder="Please provide details of your criminal record..."
                                    maxLength={1000}
                                />
                            </Form.Item>
                        ) : null
                    }
                </Form.Item>

                <Form.Item>
                    <Checkbox
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                    >
                        <strong>I confirm that all the information provided above is correct and accurate</strong>
                    </Checkbox>
                </Form.Item>

                <Form.Item>
                    <Space className="w-full" direction="horizontal" size="middle">
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/coordinatorHome')}
                            size="large"
                        >
                            Back to Dashboard
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            size="large"
                            disabled={!confirmChecked}
                            style={{ flex: 1 }}
                        >
                            Confirm and Proceed to Bank Information
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Card>
    );
}

export default PersonalDetailsForm;
