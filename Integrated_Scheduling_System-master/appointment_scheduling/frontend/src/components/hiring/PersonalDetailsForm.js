import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Upload, message, Select, Card, Space } from 'antd';
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from "../../axiosConfig";

const { TextArea } = Input;
const { Option } = Select;

const COORDINATOR_API = `/api/hiring-applications`;
const PUBLIC_API = `/api/hiring-applications`;

function PersonalDetailsForm({ applicationData, updateApplicationData, moveToNextTab, isSelfApply = false }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);
    const [medicalFitChecked, setMedicalFitChecked] = useState(false);
    const [fileList, setFileList] = useState([]);
    const [photoList, setPhotoList] = useState([]);
    const [nricFrontList, setNricFrontList] = useState([]);
    const [nricBackList, setNricBackList] = useState([]);
    const [drivingLicenseList, setDrivingLicenseList] = useState([]);
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

    const handlePhotoChange = ({ fileList: newFileList }) => {
        setPhotoList(newFileList);
        if (newFileList.length > 0) {
            const file = newFileList[0].originFileObj;
            updateApplicationData({
                profilePhoto: file,
                profilePhotoFileName: file.name
            });
        }
    };

    const handleNricFrontChange = ({ fileList: newFileList }) => {
        setNricFrontList(newFileList);
        if (newFileList.length > 0) {
            const file = newFileList[0].originFileObj;
            updateApplicationData({ nricPhotoFront: file });
        }
    };

    const handleNricBackChange = ({ fileList: newFileList }) => {
        setNricBackList(newFileList);
        if (newFileList.length > 0) {
            const file = newFileList[0].originFileObj;
            updateApplicationData({ nricPhotoBack: file });
        }
    };

    const handleDrivingLicenseChange = ({ fileList: newFileList }) => {
        setDrivingLicenseList(newFileList);
        if (newFileList.length > 0) {
            const file = newFileList[0].originFileObj;
            updateApplicationData({
                drivingLicense: file,
                drivingLicenseFileName: file.name
            });
        } else {
            updateApplicationData({
                drivingLicense: null,
                drivingLicenseFileName: null
            });
        }
    };

    const handleSubmit = async (values) => {
        if (!confirmChecked) {
            message.error('Please confirm that all information is correct');
            return;
        }

        if (!medicalFitChecked) {
            message.error('Please confirm that you are medically fit to work');
            return;
        }

        if (!applicationData.nricPhotoFront) {
            message.error('Please upload NRIC front photo');
            return;
        }

        if (!applicationData.nricPhotoBack) {
            message.error('Please upload NRIC back photo');
            return;
        }

        if (!applicationData.drivingLicense) {
            message.error('Please upload driving license');
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            data.append('applicantName', values.applicantName);
            data.append('nric', values.nric);
            data.append('citizenship', values.citizenship);
            data.append('race', values.race);
            data.append('languagesSpoken', values.languagesSpoken ? values.languagesSpoken.join(', ') : '');
            data.append('applicantAddress', values.applicantAddress);
            data.append('applicantPostalCode', values.applicantPostalCode);
            data.append('applicantPhone', values.applicantPhone);
            data.append('applicantEmail', values.applicantEmail);
            data.append('workExperience', values.workExperience);
            data.append('specializations', JSON.stringify(values.specializations || []));
            data.append('previousEmployer', values.previousEmployer || '');
            data.append('lastEmployedYear', values.lastEmployedYear ? values.lastEmployedYear.toString() : '');
            data.append('lastDrawnSalary', values.lastDrawnSalary ? values.lastDrawnSalary.toString() : '');
            data.append('nextOfKinName', values.nextOfKinName);
            data.append('nextOfKinContact', values.nextOfKinContact);
            data.append('nextOfKinRelationship', values.nextOfKinRelationship);
            data.append('isMedicallyFit', medicalFitChecked);
            data.append('hasCriminalRecord', values.hasCriminalRecord);
            data.append('criminalRecordDetails', values.hasCriminalRecord ? values.criminalRecordDetails : '');
            data.append('personalDetailsConfirmed', true);

            if (applicationData.resumeFile) {
                data.append('resumeFile', applicationData.resumeFile);
            }
            if (applicationData.resumeFileName) {
                data.append('resumeFileName', applicationData.resumeFileName);
            }
            if (applicationData.profilePhoto) {
                data.append('profilePhoto', applicationData.profilePhoto);
            }
            if (applicationData.profilePhotoFileName) {
                data.append('profilePhotoFileName', applicationData.profilePhotoFileName);
            }
            data.append('nricPhotoFront', applicationData.nricPhotoFront);
            data.append('nricPhotoBack', applicationData.nricPhotoBack);

            if (applicationData.drivingLicense) {
                data.append('drivingLicense', applicationData.drivingLicense);
            }
            if (applicationData.drivingLicenseFileName) {
                data.append('drivingLicenseFileName', applicationData.drivingLicenseFileName);
            }

            if (isSelfApply) {
                data.append('applicationSource', 'self_applied');
            }

            const apiBase = isSelfApply ? PUBLIC_API : COORDINATOR_API;

            // Create the application
            const response = await api.post(`${apiBase}/`, data);

            message.success('Personal details submitted successfully!');

            // Update application data with the response
            updateApplicationData({
                ...values,
                id: response.data.id,
                applicationStatus: 'personal_details',
                personalDetailsConfirmed: true
            });

            // Confirm personal details to move to next stage
            await api.post(`${apiBase}/${response.data.id}/confirm-personal-details/`);

            updateApplicationData({ personalDetailsConfirmed: true, applicationStatus: 'bank_info' });
            moveToNextTab();

        } catch (error) {
            console.error('Error submitting personal details:', error);
            const errData = error.response?.data;
            const errMsg = errData?.nricPhotoFront?.[0] || errData?.nricPhotoBack?.[0] || errData?.nric?.[0] || 'Failed to submit personal details. Please check all fields.';
            message.error(errMsg);
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
                    label="NRIC Front Photo"
                    required
                >
                    <Upload
                        beforeUpload={() => false}
                        onChange={handleNricFrontChange}
                        fileList={nricFrontList}
                        maxCount={1}
                        accept=".jpg,.jpeg,.png"
                        listType="picture"
                    >
                        <Button icon={<UploadOutlined />} size="large">
                            Upload NRIC Front (JPG/PNG) *
                        </Button>
                    </Upload>
                </Form.Item>

                <Form.Item
                    label="NRIC Back Photo"
                    required
                >
                    <Upload
                        beforeUpload={() => false}
                        onChange={handleNricBackChange}
                        fileList={nricBackList}
                        maxCount={1}
                        accept=".jpg,.jpeg,.png"
                        listType="picture"
                    >
                        <Button icon={<UploadOutlined />} size="large">
                            Upload NRIC Back (JPG/PNG) *
                        </Button>
                    </Upload>
                </Form.Item>

                <Form.Item
                    label="Driving License"
                    required
                    extra="Please upload a valid driving license"
                >
                    <Upload
                        beforeUpload={() => false}
                        onChange={handleDrivingLicenseChange}
                        fileList={drivingLicenseList}
                        maxCount={1}
                        accept=".jpg,.jpeg,.png,.pdf"
                        listType="picture"
                    >
                        <Button icon={<UploadOutlined />} size="large">
                            Upload Driving License (JPG/PNG/PDF) *
                        </Button>
                    </Upload>
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
                    label="Race"
                    name="race"
                    rules={[{ required: true, message: 'Please select race' }]}
                >
                    <Select placeholder="Select race" size="large">
                        <Option value="Chinese">Chinese</Option>
                        <Option value="Malay">Malay</Option>
                        <Option value="Indian">Indian</Option>
                        <Option value="Eurasian">Eurasian</Option>
                        <Option value="Other">Other</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    label="Languages Spoken"
                    name="languagesSpoken"
                    rules={[{ required: true, message: 'Please select at least one language' }]}
                >
                    <Select mode="multiple" placeholder="Select languages spoken" size="large">
                        <Option value="English">English</Option>
                        <Option value="Mandarin">Mandarin</Option>
                        <Option value="Malay">Malay</Option>
                        <Option value="Tamil">Tamil</Option>
                        <Option value="Hokkien">Hokkien</Option>
                        <Option value="Teochew">Teochew</Option>
                        <Option value="Cantonese">Cantonese</Option>
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
                    label="AC Brand Specializations"
                    name="specializations"
                    rules={[{ required: true, message: 'Please select at least one AC brand you specialize in' }]}
                    extra="Select all AC brands you have experience servicing"
                >
                    <Checkbox.Group>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {['Daikin', 'Mitsubishi', 'Panasonic', 'LG', 'Samsung', 'Fujitsu', 'Sharp', 'Toshiba', 'Hitachi', 'York', 'Other'].map(brand => (
                                <Checkbox key={brand} value={brand}>{brand}</Checkbox>
                            ))}
                        </div>
                    </Checkbox.Group>
                </Form.Item>

                <Form.Item
                    label="Previous Employer(s)"
                    name="previousEmployer"
                    rules={[{ required: false }]}
                >
                    <Input placeholder="e.g., ABC Aircon Services Pte Ltd" size="large" />
                </Form.Item>

                <Form.Item
                    label="Last Employed Year"
                    name="lastEmployedYear"
                    rules={[
                        { required: false },
                        {
                            validator: (_, value) => {
                                if (!value) return Promise.resolve();
                                const year = parseInt(value);
                                const currentYear = new Date().getFullYear();
                                if (year < 1950 || year > currentYear) {
                                    return Promise.reject(`Year must be between 1950 and ${currentYear}`);
                                }
                                return Promise.resolve();
                            }
                        }
                    ]}
                >
                    <Input placeholder="e.g., 2024" size="large" type="number" min={1950} max={new Date().getFullYear()} />
                </Form.Item>

                <Form.Item
                    label="Last Drawn Monthly Salary (SGD)"
                    name="lastDrawnSalary"
                    rules={[
                        { required: false },
                        {
                            validator: (_, value) => {
                                if (!value) return Promise.resolve();
                                const salary = parseFloat(value);
                                if (salary < 0) {
                                    return Promise.reject('Salary cannot be negative');
                                }
                                return Promise.resolve();
                            }
                        }
                    ]}
                >
                    <Input placeholder="e.g., 3000" size="large" type="number" min={0} prefix="$" />
                </Form.Item>

                {/* Next of Kin Section */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4 mt-6">
                    <h3 className="text-lg font-semibold mb-4">Next of Kin Information</h3>

                    <Form.Item
                        label="Next of Kin's Name"
                        name="nextOfKinName"
                        rules={[{ required: true, message: 'Please enter next of kin name' }]}
                    >
                        <Input placeholder="Enter next of kin's full name" size="large" />
                    </Form.Item>

                    <Form.Item
                        label="Next of Kin's Contact Number"
                        name="nextOfKinContact"
                        rules={[
                            { required: true, message: 'Please enter contact number' },
                            { pattern: /^\d{8}$/, message: 'Phone number must be 8 digits' }
                        ]}
                    >
                        <Input placeholder="e.g., 91234567" size="large" maxLength={8} />
                    </Form.Item>

                    <Form.Item
                        label="Relationship with Next of Kin"
                        name="nextOfKinRelationship"
                        rules={[{ required: true, message: 'Please select relationship' }]}
                    >
                        <Select placeholder="Select relationship" size="large">
                            <Option value="Spouse">Spouse</Option>
                            <Option value="Parent">Parent</Option>
                            <Option value="Child">Child</Option>
                            <Option value="Sibling">Sibling</Option>
                            <Option value="Relative">Relative</Option>
                            <Option value="Friend">Friend</Option>
                            <Option value="Other">Other</Option>
                        </Select>
                    </Form.Item>
                </div>

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
                    label="Profile Photo"
                    name="profilePhoto"
                >
                    <Upload
                        beforeUpload={() => false}
                        onChange={handlePhotoChange}
                        fileList={photoList}
                        maxCount={1}
                        accept=".jpg,.jpeg,.png"
                        listType="picture"
                    >
                        <Button icon={<UploadOutlined />} size="large">
                            Click to Upload Profile Photo (JPG/PNG)
                        </Button>
                    </Upload>
                </Form.Item>

                {/* Medical Fitness Declaration */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 mt-6">
                    <h3 className="text-lg font-semibold mb-2 text-blue-800">Medical Fitness Declaration</h3>
                    <p className="text-sm text-blue-700 mb-4">
                        This position requires physical fitness to perform aircon servicing work, including lifting equipment,
                        working in various environments, and performing technical tasks safely.
                    </p>
                    <Form.Item className="mb-0">
                        <Checkbox
                            checked={medicalFitChecked}
                            onChange={(e) => setMedicalFitChecked(e.target.checked)}
                        >
                            <strong>I declare that I am medically fit to work in this line of service</strong>
                        </Checkbox>
                    </Form.Item>
                </div>

                {/* Criminal Record Declaration */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <h3 className="text-lg font-semibold mb-2 text-yellow-800">Criminal Record Declaration</h3>
                    <Form.Item
                        name="hasCriminalRecord"
                        valuePropName="checked"
                        className="mb-0"
                    >
                        <Checkbox>I have a criminal record to declare</Checkbox>
                    </Form.Item>
                </div>

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
                            onClick={() => navigate(isSelfApply ? '/login' : '/coordinator/home')}
                            size="large"
                        >
                            {isSelfApply ? 'Back to Login' : 'Back to Dashboard'}
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            size="large"
                            disabled={!confirmChecked || !medicalFitChecked || !applicationData.nricPhotoFront || !applicationData.nricPhotoBack || !applicationData.drivingLicense}
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
