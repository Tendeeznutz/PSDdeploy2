import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Card, Select, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

function BankInfoForm({ applicationData, updateApplicationData, moveToNextTab, moveToPreviousTab }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);

    const handleSubmit = async (values) => {
        if (!confirmChecked) {
            message.error('Please confirm that all bank information is correct');
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
                bankInfoConfirmed: true
            };

            // Submit bank information
            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/hiring-applications/${applicationData.id}/submit-bank-info/`,
                bankData
            );

            message.success('Bank information submitted successfully!');

            // Update application data
            updateApplicationData({
                ...bankData,
                bankInfoConfirmed: true,
                applicationStatus: 'coordinator_review'
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
        <Card title="Step 2: Bank Account Information" className="mt-4">
            <p className="mb-4 text-gray-600">
                Please provide your bank account details for salary payments. This information will be kept confidential.
            </p>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
            >
                <Form.Item
                    label="Bank Name"
                    name="bankName"
                    rules={[{ required: true, message: 'Please select your bank' }]}
                >
                    <Select placeholder="Select your bank" size="large">
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
                    label="Bank Account Number"
                    name="bankAccountNumber"
                    rules={[
                        { required: true, message: 'Please enter your bank account number' },
                        { pattern: /^[0-9-]+$/, message: 'Please enter a valid account number' }
                    ]}
                >
                    <Input
                        placeholder="Enter your bank account number"
                        size="large"
                        maxLength={20}
                    />
                </Form.Item>

                <Form.Item
                    label="Account Holder Name"
                    name="bankAccountHolderName"
                    rules={[
                        { required: true, message: 'Please enter account holder name' },
                        { min: 2, message: 'Name must be at least 2 characters' }
                    ]}
                >
                    <Input
                        placeholder="Enter name as shown on bank account"
                        size="large"
                    />
                </Form.Item>

                <Form.Item>
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                        <p className="text-sm text-yellow-800">
                            <strong>Important:</strong> Please ensure that the account holder name matches your NRIC name.
                            Any discrepancies may delay your salary payments.
                        </p>
                    </div>
                </Form.Item>

                <Form.Item>
                    <Checkbox
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                    >
                        <strong>I confirm that all bank account information provided is correct and accurate</strong>
                    </Checkbox>
                </Form.Item>

                <Form.Item>
                    <Space className="w-full" direction="horizontal" size="middle">
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={moveToPreviousTab}
                            size="large"
                        >
                            Back
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            size="large"
                            disabled={!confirmChecked}
                            style={{ flex: 1 }}
                        >
                            Confirm and Submit for Coordinator Review
                        </Button>
                    </Space>
                </Form.Item>
            </Form>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
                <p className="text-sm text-blue-800">
                    After submitting your bank information, your application will be forwarded to a coordinator
                    for review. The coordinator will assess your application, determine your pay rate, and
                    make a final hiring decision.
                </p>
            </div>
        </Card>
    );
}

export default BankInfoForm;
