import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Card, InputNumber, Descriptions, Badge, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

function CoordinatorApprovalForm({ applicationData }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [approvalConfirmed, setApprovalConfirmed] = useState(false);
    const navigate = useNavigate();

    // Get coordinator ID from localStorage (assuming it's stored during login)
    const coordinatorData = JSON.parse(localStorage.getItem('coordinator_data') || '{}');
    const coordinatorId = coordinatorData.coordinator_id;

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

            const response = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/hiring-applications/${applicationData.id}/coordinator-approve/`,
                approvalData
            );

            message.success('Application approved! Technician account created successfully.');
            message.info(`Temporary password: ${response.data.temporaryPassword}`);

            // Redirect to coordinator home after a delay
            setTimeout(() => {
                navigate('/coordinatorHome');
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

            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/hiring-applications/${applicationData.id}/coordinator-reject/`,
                rejectionData
            );

            message.success('Application rejected.');

            // Redirect to coordinator home after a delay
            setTimeout(() => {
                navigate('/coordinatorHome');
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
                    <Descriptions.Item label="Previous Employer(s)">
                        {applicationData.previousEmployer || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Employed Year">
                        {applicationData.lastEmployedYear || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Drawn Monthly Salary">
                        {applicationData.lastDrawnSalary ? `$${parseFloat(applicationData.lastDrawnSalary).toFixed(2)}` : 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Resume">
                        {applicationData.resumeFileName || 'Not provided'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Criminal Record">
                        {applicationData.hasCriminalRecord ? (
                            <Badge status="warning" text={`Yes - ${applicationData.criminalRecordDetails}`} />
                        ) : (
                            <Badge status="success" text="No criminal record" />
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Bank Details">
                        <strong>{applicationData.bankName}</strong><br />
                        Account: {applicationData.bankAccountNumber}<br />
                        Holder: {applicationData.bankAccountHolderName}
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
