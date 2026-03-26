import React, { useState } from 'react';
import { Button, Checkbox, Form, Input, Select, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

import api from '../../axiosConfig';
import OwnedCard from '../ui/OwnedCard';

const { Option } = Select;

function BankInfoForm({ applicationData, updateApplicationData, moveToNextTab, moveToPreviousTab, isSelfApply = false }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);

    const handleSubmit = async (values) => {
        if (!confirmChecked) {
            message.error('Please confirm that all bank information is correct.');
            return;
        }

        if (!applicationData.id) {
            message.error('Application ID not found. Please complete Step 1 first.');
            return;
        }

        setLoading(true);
        try {
            const bankData = {
                bankName: values.bankName,
                bankAccountNumber: values.bankAccountNumber,
                bankAccountHolderName: values.bankAccountHolderName,
                bankInfoConfirmed: true,
            };

            await api.post(`/api/hiring-applications/${applicationData.id}/submit-bank-info/`, bankData);

            message.success('Bank information submitted successfully.');

            updateApplicationData({
                ...bankData,
                bankInfoConfirmed: true,
                applicationStatus: 'coordinator_review',
            });

            moveToNextTab();
        } catch (error) {
            console.error('Error submitting bank information:', error);
            message.error('Failed to submit bank information. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="space-y-6">
            <OwnedCard className="p-5 md:p-6">
                <div className="mb-5">
                    <h3 className="owned-section-title">Bank account information</h3>
                    <p className="owned-section-copy">
                        Provide the account details used for salary payments. This stage keeps the same backend submission flow and only improves the operational layout.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Form.Item
                        label="Bank name"
                        name="bankName"
                        rules={[{ required: true, message: 'Please select your bank' }]}
                    >
                        <Select placeholder="Select your bank" size="large" className="owned-input">
                            <Option value="DBS Bank">DBS Bank</Option>
                            <Option value="OCBC Bank">OCBC Bank</Option>
                            <Option value="UOB">United Overseas Bank (UOB)</Option>
                            <Option value="Standard Chartered">Standard Chartered Bank</Option>
                            <Option value="Citibank">Citibank Singapore</Option>
                            <Option value="HSBC">HSBC Singapore</Option>
                            <Option value="Maybank">Maybank Singapore</Option>
                            <Option value="POSB">POSB</Option>
                            <Option value="Other">Other</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Bank account number"
                        name="bankAccountNumber"
                        rules={[
                            { required: true, message: 'Please enter your bank account number' },
                            { pattern: /^[0-9-]+$/, message: 'Please enter a valid account number' },
                        ]}
                    >
                        <Input placeholder="Enter your bank account number" size="large" maxLength={20} className="owned-input" />
                    </Form.Item>

                    <Form.Item
                        label="Account holder name"
                        name="bankAccountHolderName"
                        rules={[
                            { required: true, message: 'Please enter account holder name' },
                            { min: 2, message: 'Name must be at least 2 characters' },
                        ]}
                        className="md:col-span-2"
                    >
                        <Input placeholder="Enter name as shown on bank account" size="large" className="owned-input" />
                    </Form.Item>
                </div>
            </OwnedCard>

            <OwnedCard className="p-5 md:p-6">
                <div className="owned-inline-note">
                    Important: the account holder name should match the NRIC name submitted in Stage 1. Any mismatch may delay payments.
                </div>

                <Form.Item className="mb-0 mt-6">
                    <Checkbox checked={confirmChecked} onChange={(event) => setConfirmChecked(event.target.checked)}>
                        <strong>I confirm that all bank account information provided is correct and accurate.</strong>
                    </Checkbox>
                </Form.Item>
            </OwnedCard>

            <OwnedCard className="p-5 md:p-6">
                <h3 className="owned-section-title">What happens next</h3>
                <p className="owned-section-copy">
                    {isSelfApply
                        ? 'After this submission, your application moves into coordinator review. You will not complete the review stage yourself.'
                        : 'After this submission, the application moves into coordinator review so the final hiring decision can be made.'}
                </p>
            </OwnedCard>

            <div className="owned-action-row pt-2">
                <Button icon={<ArrowLeftOutlined />} onClick={moveToPreviousTab} size="large" className="owned-secondary-button">
                    Back
                </Button>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    disabled={!confirmChecked}
                    className="owned-primary-button"
                >
                    Confirm and submit for coordinator review
                </Button>
            </div>
        </Form>
    );
}

export default BankInfoForm;
