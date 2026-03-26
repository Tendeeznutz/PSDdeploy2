import React, { useState } from 'react';
import {
    Badge,
    Button,
    Checkbox,
    Descriptions,
    Form,
    Input,
    InputNumber,
    Space,
    Tag,
    message,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import api from '../../axiosConfig';
import OwnedCard from '../ui/OwnedCard';

const { TextArea } = Input;

function CoordinatorApprovalForm({ applicationData, onComplete }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [approvalConfirmed, setApprovalConfirmed] = useState(false);
    const navigate = useNavigate();
    const coordinatorId = localStorage.getItem('coordinators_id');

    const handleApprove = async (values) => {
        if (!approvalConfirmed) {
            message.error('Please confirm that you approve this hiring.');
            return;
        }

        if (!applicationData.id) {
            message.error('Application ID not found.');
            return;
        }

        setLoading(true);
        try {
            const approvalData = {
                coordinatorId,
                payRate: values.payRate,
                coordinatorNotes: values.coordinatorNotes || '',
                coordinatorApproved: true,
            };

            const response = await api.post(`/api/hiring-applications/${applicationData.id}/coordinator-approve/`, approvalData);

            message.success('Application approved. Technician account created successfully.');
            message.info(`Temporary password: ${response.data.temporaryPassword}`);

            setTimeout(() => {
                if (onComplete) onComplete();
                else navigate('/coordinator/home');
            }, 3000);
        } catch (error) {
            console.error('Error approving application:', error);
            message.error(error.response?.data?.error || 'Failed to approve application. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (values) => {
        if (!applicationData.id) {
            message.error('Application ID not found.');
            return;
        }

        if (!values.coordinatorNotes || values.coordinatorNotes.trim() === '') {
            message.error('Please provide a reason for rejection.');
            return;
        }

        setLoading(true);
        try {
            await api.post(`/api/hiring-applications/${applicationData.id}/coordinator-reject/`, {
                coordinatorId,
                coordinatorNotes: values.coordinatorNotes,
            });

            message.success('Application rejected.');

            setTimeout(() => {
                if (onComplete) onComplete();
                else navigate('/coordinator/home');
            }, 2000);
        } catch (error) {
            console.error('Error rejecting application:', error);
            message.error('Failed to reject application. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const specializations = Array.isArray(applicationData.specializations)
        ? applicationData.specializations
        : typeof applicationData.specializations === 'string' && applicationData.specializations
            ? JSON.parse(applicationData.specializations)
            : [];

    return (
        <div className="space-y-6">
            <OwnedCard className="p-5 md:p-6">
                <div className="mb-5">
                    <h3 className="owned-section-title">Application summary</h3>
                    <p className="owned-section-copy">
                        Review the submitted applicant details before deciding whether to create the technician account.
                    </p>
                </div>

                {applicationData.profilePhotoFileName ? (
                    <div className="mb-6 text-center">
                        <p className="text-sm text-[#6B7280]">Profile photo</p>
                        <div className="mt-2 inline-block rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-sm text-[#22252E]">
                            {applicationData.profilePhotoFileName}
                        </div>
                    </div>
                ) : null}

                {(typeof applicationData.nricPhotoFront === 'string' || typeof applicationData.nricPhotoBack === 'string') ? (
                    <div className="mb-6">
                        <h4 className="text-base font-semibold text-[#22252E]">NRIC photos</h4>
                        <div className="mt-3 flex flex-wrap gap-4">
                            {typeof applicationData.nricPhotoFront === 'string' && applicationData.nricPhotoFront ? (
                                <div>
                                    <p className="mb-1 text-sm text-[#6B7280]">Front</p>
                                    <img
                                        src={applicationData.nricPhotoFront.startsWith('http') ? applicationData.nricPhotoFront : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}${applicationData.nricPhotoFront}`}
                                        alt="NRIC Front"
                                        className="max-w-xs rounded-xl border border-[#E5E7EB]"
                                        style={{ maxHeight: 200 }}
                                    />
                                </div>
                            ) : null}
                            {typeof applicationData.nricPhotoBack === 'string' && applicationData.nricPhotoBack ? (
                                <div>
                                    <p className="mb-1 text-sm text-[#6B7280]">Back</p>
                                    <img
                                        src={applicationData.nricPhotoBack.startsWith('http') ? applicationData.nricPhotoBack : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}${applicationData.nricPhotoBack}`}
                                        alt="NRIC Back"
                                        className="max-w-xs rounded-xl border border-[#E5E7EB]"
                                        style={{ maxHeight: 200 }}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                <Descriptions bordered column={1} size="small" labelStyle={{ width: '34%' }}>
                    <Descriptions.Item label="Applicant name"><strong>{applicationData.applicantName}</strong></Descriptions.Item>
                    <Descriptions.Item label="NRIC">{applicationData.nric}</Descriptions.Item>
                    <Descriptions.Item label="Citizenship">{applicationData.citizenship}</Descriptions.Item>
                    <Descriptions.Item label="Race">{applicationData.race || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Languages spoken">{applicationData.languagesSpoken || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Address">{applicationData.applicantAddress}, Singapore {applicationData.applicantPostalCode}</Descriptions.Item>
                    <Descriptions.Item label="Contact">
                        Phone: {applicationData.applicantPhone}
                        <br />
                        Email: {applicationData.applicantEmail}
                    </Descriptions.Item>
                    <Descriptions.Item label="Work experience">
                        <div className="whitespace-pre-wrap">{applicationData.workExperience}</div>
                    </Descriptions.Item>
                    <Descriptions.Item label="AC brand specializations">
                        {specializations.length > 0 ? (
                            <Space wrap>
                                {specializations.map((brand) => <Tag color="blue" key={brand}>{brand}</Tag>)}
                            </Space>
                        ) : (
                            <span className="text-[#6B7280]">None specified</span>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Previous employer(s)">{applicationData.previousEmployer || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Last employed year">{applicationData.lastEmployedYear || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Last drawn monthly salary">
                        {applicationData.lastDrawnSalary ? `$${parseFloat(applicationData.lastDrawnSalary).toFixed(2)}` : 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Next of kin">
                        {applicationData.nextOfKinName || 'Not provided'}
                        <br />
                        {applicationData.nextOfKinRelationship || 'Relationship not provided'}
                        <br />
                        {applicationData.nextOfKinContact || 'Contact not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Resume">{applicationData.resumeFileName || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Driving license">{applicationData.drivingLicenseFileName || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Medical fitness declaration">
                        {applicationData.isMedicallyFit ? <Badge status="success" text="Declared medically fit to work" /> : <Badge status="error" text="Not declared" />}
                    </Descriptions.Item>
                    <Descriptions.Item label="Criminal record">
                        {applicationData.hasCriminalRecord
                            ? <Badge status="warning" text={`Yes - ${applicationData.criminalRecordDetails}`} />
                            : <Badge status="success" text="No criminal record" />}
                    </Descriptions.Item>
                    <Descriptions.Item label="Bank account">
                        {applicationData.bankName}
                        <br />
                        {applicationData.bankAccountNumber}
                        <br />
                        {applicationData.bankAccountHolderName}
                    </Descriptions.Item>
                </Descriptions>
            </OwnedCard>

            <OwnedCard className="p-5 md:p-6">
                <div className="mb-5">
                    <h3 className="owned-section-title">Decision and pay rate</h3>
                    <p className="owned-section-copy">
                        Approving this application creates the technician account immediately using the existing backend flow.
                    </p>
                </div>

                <Form form={form} layout="vertical" onFinish={handleApprove}>
                    <div className="grid gap-6 md:grid-cols-2">
                        <Form.Item
                            label="Hourly pay rate (SGD)"
                            name="payRate"
                            rules={[
                                { required: true, message: 'Please enter the pay rate' },
                                { type: 'number', min: 8, message: 'Pay rate must be at least $8/hour' },
                                { type: 'number', max: 100, message: 'Pay rate cannot exceed $100/hour' },
                            ]}
                        >
                            <InputNumber prefix="$" suffix="/ hour" size="large" className="owned-input w-full" precision={2} placeholder="e.g., 15.00" />
                        </Form.Item>

                        <Form.Item
                            label="Coordinator notes"
                            name="coordinatorNotes"
                            className="md:col-span-2"
                        >
                            <TextArea rows={4} placeholder="Add any notes about this applicant or the hiring decision..." maxLength={1000} showCount className="owned-input" />
                        </Form.Item>
                    </div>

                    <div className="owned-inline-note mb-6">
                        Upon approval, a technician account will be created and temporary credentials will be returned in the success response.
                    </div>

                    <Form.Item>
                        <Checkbox checked={approvalConfirmed} onChange={(event) => setApprovalConfirmed(event.target.checked)}>
                            <strong>I confirm that I have reviewed this application and approve the hiring of this technician.</strong>
                        </Checkbox>
                    </Form.Item>

                    <Form.Item className="mb-0">
                        <Space className="w-full" direction="horizontal" size="middle" wrap>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                size="large"
                                disabled={!approvalConfirmed}
                                icon={<CheckCircleOutlined />}
                                className="owned-primary-button"
                            >
                                Approve and create technician account
                            </Button>
                            <Button
                                danger
                                onClick={() => {
                                    form.validateFields(['coordinatorNotes']).then((values) => {
                                        handleReject(values);
                                    });
                                }}
                                loading={loading}
                                size="large"
                                icon={<CloseCircleOutlined />}
                            >
                                Reject application
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </OwnedCard>
        </div>
    );
}

export default CoordinatorApprovalForm;
