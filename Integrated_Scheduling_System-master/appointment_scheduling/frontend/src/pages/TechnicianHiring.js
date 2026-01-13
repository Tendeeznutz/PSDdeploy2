import React, { useState } from 'react';
import { Tabs, message } from 'antd';
import PersonalDetailsForm from '../components/hiring/PersonalDetailsForm';
import BankInfoForm from '../components/hiring/BankInfoForm';
import CoordinatorApprovalForm from '../components/hiring/CoordinatorApprovalForm';

const { TabPane } = Tabs;

function TechnicianHiring() {
    const [activeTab, setActiveTab] = useState('1');
    const [applicationData, setApplicationData] = useState({
        // Stage 1: Personal Details
        applicantName: '',
        nric: '',
        citizenship: '',
        applicantAddress: '',
        applicantPostalCode: '',
        applicantPhone: '',
        applicantEmail: '',
        workExperience: '',
        resumeFile: null,
        resumeFileName: '',
        hasCriminalRecord: false,
        criminalRecordDetails: '',
        personalDetailsConfirmed: false,

        // Stage 2: Bank Info
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolderName: '',
        bankInfoConfirmed: false,

        // Stage 3: Coordinator Approval
        payRate: '',
        coordinatorId: '',
        coordinatorNotes: '',
        coordinatorApproved: false,

        // Application ID (set after creation)
        id: null,
        applicationStatus: 'personal_details'
    });

    const handleTabChange = (key) => {
        // Prevent going back once bank info is confirmed (coordinator review stage)
        if (applicationData.bankInfoConfirmed && parseInt(key) < 3) {
            message.warning('Cannot go back once application is submitted for coordinator review');
            return;
        }

        // Validate before allowing tab change forward
        if (key === '2' && !applicationData.personalDetailsConfirmed) {
            message.warning('Please confirm personal details first');
            return;
        }
        if (key === '3' && !applicationData.bankInfoConfirmed) {
            message.warning('Please confirm bank information first');
            return;
        }
        setActiveTab(key);
    };

    const updateApplicationData = (newData) => {
        setApplicationData(prev => ({ ...prev, ...newData }));
    };

    const moveToNextTab = () => {
        const nextTab = (parseInt(activeTab) + 1).toString();
        setActiveTab(nextTab);
    };

    const moveToPreviousTab = () => {
        // Only allow going back if bank info is not yet confirmed
        if (applicationData.bankInfoConfirmed) {
            message.warning('Cannot go back once application is submitted for coordinator review');
            return;
        }
        const prevTab = (parseInt(activeTab) - 1).toString();
        setActiveTab(prevTab);
    };

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">Technician Hiring Application</h1>

            <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                type="card"
                size="large"
            >
                <TabPane
                    tab="1. Personal Details"
                    key="1"
                    disabled={false}
                >
                    <PersonalDetailsForm
                        applicationData={applicationData}
                        updateApplicationData={updateApplicationData}
                        moveToNextTab={moveToNextTab}
                    />
                </TabPane>

                <TabPane
                    tab="2. Bank Information"
                    key="2"
                    disabled={!applicationData.personalDetailsConfirmed}
                >
                    <BankInfoForm
                        applicationData={applicationData}
                        updateApplicationData={updateApplicationData}
                        moveToNextTab={moveToNextTab}
                        moveToPreviousTab={moveToPreviousTab}
                    />
                </TabPane>

                <TabPane
                    tab="3. Coordinator Approval"
                    key="3"
                    disabled={!applicationData.bankInfoConfirmed}
                >
                    <CoordinatorApprovalForm
                        applicationData={applicationData}
                        updateApplicationData={updateApplicationData}
                    />
                </TabPane>
            </Tabs>
        </div>
    );
}

export default TechnicianHiring;
