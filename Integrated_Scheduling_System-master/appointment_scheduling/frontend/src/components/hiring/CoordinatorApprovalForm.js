import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Card, InputNumber, Descriptions, Badge, Space, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from "../../axiosConfig";
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

function CoordinatorApprovalForm({ applicationData, onComplete }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [approvalConfirmed, setApprovalConfirmed] = useState(false);
    const navigate = useNavigate();

    // Get coordinator ID from localStorage (stored during login)
    const coordinatorId = localStorage.getItem('coordinators_id');

    const handleApprove = async (values) => {
        if (!approvalConfirmed) {
            message.error('Please confirm that you approve this hiring');
            return;
        }

        if (!applicationData.id) {
            message.error('Application ID not found');
            return;
        }

        setLoading(true);
        try {
            const approvalData = {
                coordinatorId: coordinatorId,
                payRate: values.payRate,
                coordinatorNotes: values.coordinatorNotes || '',
                coordinatorApproved: true
            };

            const response = await api.post(
                `/api/hiring-applications/${applicationData.id}/coordinator-approve/`,
                approvalData
            );

            message.success('Application approved! Technician account created successfully.');
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
            message.error('Application ID not found');
            return;
        }

        if (!values.coordinatorNotes || values.coordinatorNotes.trim() === '') {
            message.error('Please provide a reason for rejection');
            return;
        }

        setLoading(true);
        try {
            const rejectionData = {
                coordinatorId: coordinatorId,
                coordinatorNotes: values.coordinatorNotes
            };

            await api.post(
                `/api/hiring-applications/${applicationData.id}/coordinator-reject/`,
                rejectionData
            );

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

    return (
        <Card title="Step 3: Coordinator Review and Approval" className="mt-4">
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Application Summary</h3>

                {/* Profile Photo */}
                {applicationData.profilePhotoFileName && (
                    <div className="mb-4 text-center">
                        <p className="text-sm text-gray-500 mb-2">Profile Photo</p>
                        <div className="inline-block border rounded-lg p-2 bg-gray-50">
                            <span className="text-gray-700">{applicationData.profilePhotoFileName}</span>
                        </div>
                    </div>
                )}

                {/* NRIC Photos */}
                {(typeof applicationData.nricPhotoFront === 'string' || typeof applicationData.nricPhotoBack === 'string') && (
                    <div className="mb-4">
                        <h4 className="text-md font-semibold mb-2">NRIC Photos</h4>
                        <div className="flex gap-4 flex-wrap">
                            {typeof applicationData.nricPhotoFront === 'string' && applicationData.nricPhotoFront && (
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Front</p>
                                    <img
                                        src={applicationData.nricPhotoFront.startsWith('http') ? applicationData.nricPhotoFront : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}${applicationData.nricPhotoFront}`}
                                        alt="NRIC Front"
                                        className="max-w-xs border rounded"
                                        style={{ maxHeight: 200 }}
                                    />
                                </div>
                            )}
                            {typeof applicationData.nricPhotoBack === 'string' && applicationData.nricPhotoBack && (
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Back</p>
                                    <img
                                        src={applicationData.nricPhotoBack.startsWith('http') ? applicationData.nricPhotoBack : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}${applicationData.nricPhotoBack}`}
                                        alt="NRIC Back"
                                        className="max-w-xs border rounded"
                                        style={{ maxHeight: 200 }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Applicant Name">
                        <strong>{applicationData.applicantName}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="NRIC">
                        {applicationData.nric}
                    </Descriptions.Item>
                    <Descriptions.Item label="Citizenship">
                        {applicationData.citizenship}
                    </Descriptions.Item>
                    <Descriptions.Item label="Race">
                        {applicationData.race || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Languages Spoken">
                        {applicationData.languagesSpoken || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Address">
                        {applicationData.applicantAddress}, Singapore {applicationData.applicantPostalCode}
                    </Descriptions.Item>
                    <Descriptions.Item label="Contact">
                        Phone: {applicationData.applicantPhone}<br />
                        Email: {applicationData.applicantEmail}
                    </Descriptions.Item>
                    <Descriptions.Item label="Work Experience">
                        <div className="whitespace-pre-wrap">{applicationData.workExperience}</div>
                    </Descriptions.Item>
                    <Descriptions.Item label="AC Brand Specializations">
                        {applicationData.specializations && applicationData.specializations.length > 0 ? (
                            <Space wrap>
                                {(typeof applicationData.specializations === 'string'
                                    ? JSON.parse(applicationData.specializations)
                                    : applicationData.specializations
                                ).map(brand => (
                                    <Tag color="blue" key={brand}>{brand}</Tag>
                                ))}
                            </Space>
                        ) : (
                            <span className="text-gray-400">None specified</span>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Previous Employer(s)">
                        {applicationData.previousEmployer || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Employed Year">
                        {applicationData.lastEmployedYear || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Drawn Monthly Salary">
                        {applicationData.lastDrawnSalary ? `$${parseFloat(applicationData.lastDrawnSalary).toFixed(2)}` : 'Not provided'}
                    </Descriptions.Item>
                </Descriptions>

                {/* Next of Kin Section */}
                <h4 className="text-md font-semibold mt-4 mb-2">Next of Kin Information</h4>
                <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Name">
                        {applicationData.nextOfKinName || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Contact Number">
                        {applicationData.nextOfKinContact || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Relationship">
                        {applicationData.nextOfKinRelationship || 'Not provided'}
                    </Descriptions.Item>
                </Descriptions>

                {/* Documents and Declarations */}
                <h4 className="text-md font-semibold mt-4 mb-2">Documents and Declarations</h4>
                <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Resume">
                        {applicationData.resumeFileName || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Profile Photo">
                        {applicationData.profilePhotoFileName || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Medical Fitness Declaration">
                        {applicationData.isMedicallyFit ? (
                            <Badge status="success" text="Declared medically fit to work" />
                        ) : (
                            <Badge status="error" text="Not declared" />
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Criminal Record">
                        {applicationData.hasCriminalRecord ? (
                            <Badge status="warning" text={`Yes - ${applicationData.criminalRecordDetails}`} />
                        ) : (
                            <Badge status="success" text="No criminal record" />
                        )}
                    </Descriptions.Item>
                </Descriptions>

                {/* Bank Details */}
                <h4 className="text-md font-semibold mt-4 mb-2">Bank Account Information</h4>
                <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Bank Name">
                        <strong>{applicationData.bankName}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Account Number">
                        {applicationData.bankAccountNumber}
                    </Descriptions.Item>
                    <Descriptions.Item label="Account Holder Name">
                        {applicationData.bankAccountHolderName}
                    </Descriptions.Item>
                </Descriptions>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleApprove}
            >
                <Form.Item
                    label="Hourly Pay Rate (SGD)"
                    name="payRate"
                    rules={[
                        { required: true, message: 'Please enter the pay rate' },
                        { type: 'number', min: 8, message: 'Pay rate must be at least $8/hour' },
                        { type: 'number', max: 100, message: 'Pay rate cannot exceed $100/hour' }
                    ]}
                >
                    <InputNumber
                        prefix="$"
                        suffix="/ hour"
                        size="large"
                        className="w-full"
                        precision={2}
                        placeholder="e.g., 15.00"
                    />
                </Form.Item>

                <Form.Item
                    label="Coordinator Notes"
                    name="coordinatorNotes"
                    rules={[
                        { required: false }
                    ]}
                >
                    <TextArea
                        rows={4}
                        placeholder="Add any notes about this applicant or the hiring decision..."
                        maxLength={1000}
                        showCount
                    />
                </Form.Item>

                <Form.Item>
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> Upon approval, a technician account will be automatically created.
                            The new technician will receive temporary login credentials.
                        </p>
                    </div>
                </Form.Item>

                <Form.Item>
                    <Checkbox
                        checked={approvalConfirmed}
                        onChange={(e) => setApprovalConfirmed(e.target.checked)}
                    >
                        <strong>I confirm that I have reviewed this application and approve the hiring of this technician</strong>
                    </Checkbox>
                </Form.Item>

                <Form.Item>
                    <Space className="w-full" direction="horizontal" size="middle">
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            size="large"
                            disabled={!approvalConfirmed}
                            icon={<CheckCircleOutlined />}
                            className="flex-1"
                        >
                            Approve and Create Technician Account
                        </Button>

                        <Button
                            danger
                            onClick={() => {
                                form.validateFields(['coordinatorNotes']).then(values => {
                                    handleReject(values);
                                });
                            }}
                            loading={loading}
                            size="large"
                            icon={<CloseCircleOutlined />}
                        >
                            Reject Application
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Card>
    );
}

export default CoordinatorApprovalForm;
