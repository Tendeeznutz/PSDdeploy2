import React, { useState } from 'react';
import { Button, Checkbox, Form, Input, Select, Upload, message } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import api from '../../axiosConfig';
import OwnedCard from '../ui/OwnedCard';

const { TextArea } = Input;
const { Option } = Select;

const COORDINATOR_API = '/api/hiring-applications';
const PUBLIC_API = '/api/hiring-applications';

function HiringSection({ title, description, children }) {
    return (
        <OwnedCard className="p-5 md:p-6">
            <div className="mb-5">
                <h3 className="owned-section-title">{title}</h3>
                {description ? <p className="owned-section-copy">{description}</p> : null}
            </div>
            {children}
        </OwnedCard>
    );
}

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
                resumeFileName: file.name,
            });
        }
    };

    const handlePhotoChange = ({ fileList: newFileList }) => {
        setPhotoList(newFileList);
        if (newFileList.length > 0) {
            const file = newFileList[0].originFileObj;
            updateApplicationData({
                profilePhoto: file,
                profilePhotoFileName: file.name,
            });
        }
    };

    const handleNricFrontChange = ({ fileList: newFileList }) => {
        setNricFrontList(newFileList);
        if (newFileList.length > 0) {
            updateApplicationData({ nricPhotoFront: newFileList[0].originFileObj });
        }
    };

    const handleNricBackChange = ({ fileList: newFileList }) => {
        setNricBackList(newFileList);
        if (newFileList.length > 0) {
            updateApplicationData({ nricPhotoBack: newFileList[0].originFileObj });
        }
    };

    const handleDrivingLicenseChange = ({ fileList: newFileList }) => {
        setDrivingLicenseList(newFileList);
        if (newFileList.length > 0) {
            const file = newFileList[0].originFileObj;
            updateApplicationData({
                drivingLicense: file,
                drivingLicenseFileName: file.name,
            });
        } else {
            updateApplicationData({
                drivingLicense: null,
                drivingLicenseFileName: null,
            });
        }
    };

    const handleSubmit = async (values) => {
        if (!confirmChecked) {
            message.error('Please confirm that all information is correct.');
            return;
        }

        if (!medicalFitChecked) {
            message.error('Please confirm that you are medically fit to work.');
            return;
        }

        if (!applicationData.nricPhotoFront) {
            message.error('Please upload NRIC front photo.');
            return;
        }

        if (!applicationData.nricPhotoBack) {
            message.error('Please upload NRIC back photo.');
            return;
        }

        if (!applicationData.drivingLicense) {
            message.error('Please upload driving license.');
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
            const response = await api.post(`${apiBase}/`, data);

            message.success('Personal details submitted successfully.');

            updateApplicationData({
                ...values,
                id: response.data.id,
                applicationStatus: 'personal_details',
                personalDetailsConfirmed: true,
            });

            await api.post(`${apiBase}/${response.data.id}/confirm-personal-details/`);

            updateApplicationData({ personalDetailsConfirmed: true, applicationStatus: 'bank_info' });
            moveToNextTab();
        } catch (error) {
            console.error('Error submitting personal details:', error);
            const errData = error.response?.data;
            const errMsg = errData?.nricPhotoFront?.[0]
                || errData?.nricPhotoBack?.[0]
                || errData?.nric?.[0]
                || 'Failed to submit personal details. Please check all fields.';
            message.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ hasCriminalRecord: false }}
            className="space-y-6"
        >
            <HiringSection title="Identity and contact details" description="Provide the personal details and contact information required to create the application record.">
                <div className="grid gap-6 md:grid-cols-2">
                    <Form.Item
                        label="Full name"
                        name="applicantName"
                        rules={[{ required: true, message: 'Please enter full name' }]}
                    >
                        <Input placeholder="Enter full name" size="large" className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="NRIC"
                        name="nric"
                        rules={[
                            { required: true, message: 'Please enter NRIC' },
                            { pattern: /^[STFG]\d{7}[A-Z]$/, message: 'Invalid NRIC format (e.g., S1234567A)' },
                        ]}
                    >
                        <Input placeholder="e.g., S1234567A" size="large" className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Citizenship"
                        name="citizenship"
                        rules={[{ required: true, message: 'Please select citizenship' }]}
                    >
                        <Select placeholder="Select citizenship" size="large" className="owned-input">
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
                        <Select placeholder="Select race" size="large" className="owned-input">
                            <Option value="Chinese">Chinese</Option>
                            <Option value="Malay">Malay</Option>
                            <Option value="Indian">Indian</Option>
                            <Option value="Eurasian">Eurasian</Option>
                            <Option value="Other">Other</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Phone number"
                        name="applicantPhone"
                        rules={[
                            { required: true, message: 'Please enter phone number' },
                            { pattern: /^\d{8}$/, message: 'Phone number must be 8 digits' },
                        ]}
                    >
                        <Input placeholder="e.g., 91234567" size="large" maxLength={8} className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Email address"
                        name="applicantEmail"
                        rules={[
                            { required: true, message: 'Please enter email' },
                            { type: 'email', message: 'Please enter a valid email' },
                        ]}
                    >
                        <Input placeholder="email@example.com" size="large" className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Languages spoken"
                        name="languagesSpoken"
                        rules={[{ required: true, message: 'Please select at least one language' }]}
                        className="md:col-span-2"
                    >
                        <Select mode="multiple" placeholder="Select languages spoken" size="large" className="owned-input">
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
                        label="Residential address"
                        name="applicantAddress"
                        rules={[{ required: true, message: 'Please enter address' }]}
                        className="md:col-span-2"
                    >
                        <Input placeholder="Enter full address" size="large" className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Postal code"
                        name="applicantPostalCode"
                        rules={[
                            { required: true, message: 'Please enter postal code' },
                            { pattern: /^\d{6}$/, message: 'Postal code must be 6 digits' },
                        ]}
                    >
                        <Input placeholder="e.g., 123456" size="large" maxLength={6} className="owned-input" />
                    </Form.Item>
                </div>
            </HiringSection>

            <HiringSection title="Required identity documents" description="These uploads are compulsory for creating the hiring application and are checked before the flow can proceed.">
                <div className="grid gap-6 md:grid-cols-2">
                    <Form.Item label="NRIC front photo" required>
                        <Upload beforeUpload={() => false} onChange={handleNricFrontChange} fileList={nricFrontList} maxCount={1} accept=".jpg,.jpeg,.png" listType="picture">
                            <Button icon={<UploadOutlined />} size="large" className="owned-secondary-button w-full">
                                Upload NRIC front
                            </Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item label="NRIC back photo" required>
                        <Upload beforeUpload={() => false} onChange={handleNricBackChange} fileList={nricBackList} maxCount={1} accept=".jpg,.jpeg,.png" listType="picture">
                            <Button icon={<UploadOutlined />} size="large" className="owned-secondary-button w-full">
                                Upload NRIC back
                            </Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item label="Driving license" required extra="Please upload a valid driving license." className="md:col-span-2">
                        <Upload beforeUpload={() => false} onChange={handleDrivingLicenseChange} fileList={drivingLicenseList} maxCount={1} accept=".jpg,.jpeg,.png,.pdf" listType="picture">
                            <Button icon={<UploadOutlined />} size="large" className="owned-secondary-button w-full md:w-auto">
                                Upload driving license
                            </Button>
                        </Upload>
                    </Form.Item>
                </div>
            </HiringSection>

            <HiringSection title="Experience and service qualifications" description="Group the applicant’s relevant service background, brand coverage, and supporting documents in one operational section.">
                <div className="grid gap-6 md:grid-cols-2">
                    <Form.Item
                        label="Work experience"
                        name="workExperience"
                        rules={[{ required: true, message: 'Please describe your work experience' }]}
                        className="md:col-span-2"
                    >
                        <TextArea rows={6} placeholder="Describe your relevant work experience, skills, and qualifications..." maxLength={2000} showCount className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="AC brand specializations"
                        name="specializations"
                        rules={[{ required: true, message: 'Please select at least one AC brand you specialize in' }]}
                        extra="Select all AC brands you have experience servicing."
                        className="md:col-span-2"
                    >
                        <Checkbox.Group>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                {['Daikin', 'Mitsubishi', 'Panasonic', 'LG', 'Samsung', 'Fujitsu', 'Sharp', 'Toshiba', 'Hitachi', 'York', 'Other'].map((brand) => (
                                    <Checkbox key={brand} value={brand}>{brand}</Checkbox>
                                ))}
                            </div>
                        </Checkbox.Group>
                    </Form.Item>

                    <Form.Item label="Previous employer(s)" name="previousEmployer">
                        <Input placeholder="e.g., ABC Aircon Services Pte Ltd" size="large" className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Last employed year"
                        name="lastEmployedYear"
                        rules={[
                            {
                                validator: (_, value) => {
                                    if (!value) return Promise.resolve();
                                    const year = parseInt(value, 10);
                                    const currentYear = new Date().getFullYear();
                                    if (year < 1950 || year > currentYear) {
                                        return Promise.reject(new Error(`Year must be between 1950 and ${currentYear}`));
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >
                        <Input placeholder="e.g., 2024" size="large" type="number" min={1950} max={new Date().getFullYear()} className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Last drawn monthly salary (SGD)"
                        name="lastDrawnSalary"
                        rules={[
                            {
                                validator: (_, value) => {
                                    if (!value) return Promise.resolve();
                                    if (parseFloat(value) < 0) {
                                        return Promise.reject(new Error('Salary cannot be negative'));
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >
                        <Input placeholder="e.g., 3000" size="large" type="number" min={0} prefix="$" className="owned-input" />
                    </Form.Item>

                    <Form.Item label="Resume upload" name="resumeFile">
                        <Upload beforeUpload={() => false} onChange={handleFileChange} fileList={fileList} maxCount={1} accept=".pdf,.doc,.docx">
                            <Button icon={<UploadOutlined />} size="large" className="owned-secondary-button w-full md:w-auto">
                                Upload resume
                            </Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item label="Profile photo" name="profilePhoto">
                        <Upload beforeUpload={() => false} onChange={handlePhotoChange} fileList={photoList} maxCount={1} accept=".jpg,.jpeg,.png" listType="picture">
                            <Button icon={<UploadOutlined />} size="large" className="owned-secondary-button w-full md:w-auto">
                                Upload profile photo
                            </Button>
                        </Upload>
                    </Form.Item>
                </div>
            </HiringSection>

            <HiringSection title="Next of kin details" description="Collect emergency contact details as part of the same hiring workflow.">
                <div className="grid gap-6 md:grid-cols-3">
                    <Form.Item
                        label="Next of kin's name"
                        name="nextOfKinName"
                        rules={[{ required: true, message: 'Please enter next of kin name' }]}
                    >
                        <Input placeholder="Enter next of kin's full name" size="large" className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Next of kin's contact number"
                        name="nextOfKinContact"
                        rules={[
                            { required: true, message: 'Please enter contact number' },
                            { pattern: /^\d{8}$/, message: 'Phone number must be 8 digits' },
                        ]}
                    >
                        <Input placeholder="e.g., 91234567" size="large" maxLength={8} className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Relationship"
                        name="nextOfKinRelationship"
                        rules={[{ required: true, message: 'Please select relationship' }]}
                    >
                        <Select placeholder="Select relationship" size="large" className="owned-input">
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
            </HiringSection>

            <HiringSection title="Declarations and confirmation" description="Capture medical fitness, criminal-record declarations, and final applicant confirmation before the application moves forward.">
                <div className="space-y-4">
                    <div className="owned-inline-note">
                        This role involves field work, travel, and equipment handling. The declarations below are part of the real submission contract.
                    </div>

                    <div className="rounded-xl border border-[#BFD0E4] bg-[#F8FBFE] p-4">
                        <h4 className="text-base font-semibold text-[#22252E]">Medical fitness declaration</h4>
                        <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                            This position requires physical fitness to perform aircon servicing work safely across different environments.
                        </p>
                        <Form.Item className="mb-0 mt-4">
                            <Checkbox checked={medicalFitChecked} onChange={(event) => setMedicalFitChecked(event.target.checked)}>
                                <strong>I declare that I am medically fit to work in this line of service.</strong>
                            </Checkbox>
                        </Form.Item>
                    </div>

                    <div className="rounded-xl border border-[#EAD9A3] bg-[#FFF9E8] p-4">
                        <h4 className="text-base font-semibold text-[#22252E]">Criminal record declaration</h4>
                        <Form.Item name="hasCriminalRecord" valuePropName="checked" className="mb-0 mt-4">
                            <Checkbox>I have a criminal record to declare.</Checkbox>
                        </Form.Item>
                    </div>

                    <Form.Item noStyle shouldUpdate={(previousValues, currentValues) => previousValues.hasCriminalRecord !== currentValues.hasCriminalRecord}>
                        {({ getFieldValue }) => (
                            getFieldValue('hasCriminalRecord') ? (
                                <Form.Item
                                    label="Criminal record details"
                                    name="criminalRecordDetails"
                                    rules={[{ required: true, message: 'Please provide details' }]}
                                >
                                    <TextArea rows={4} placeholder="Please provide details of your criminal record..." maxLength={1000} className="owned-input" />
                                </Form.Item>
                            ) : null
                        )}
                    </Form.Item>

                    <Form.Item className="mb-0">
                        <Checkbox checked={confirmChecked} onChange={(event) => setConfirmChecked(event.target.checked)}>
                            <strong>I confirm that all the information provided above is correct and accurate.</strong>
                        </Checkbox>
                    </Form.Item>
                </div>
            </HiringSection>

            <div className="owned-action-row pt-2">
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(isSelfApply ? '/login' : '/coordinator/home')}
                    size="large"
                    className="owned-secondary-button"
                >
                    {isSelfApply ? 'Back to login' : 'Back to dashboard'}
                </Button>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    disabled={!confirmChecked || !medicalFitChecked || !applicationData.nricPhotoFront || !applicationData.nricPhotoBack || !applicationData.drivingLicense}
                    className="owned-primary-button"
                >
                    Confirm and continue to bank information
                </Button>
            </div>
        </Form>
    );
}

export default PersonalDetailsForm;
