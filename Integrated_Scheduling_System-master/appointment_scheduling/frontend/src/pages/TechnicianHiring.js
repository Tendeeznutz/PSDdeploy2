import React, { useMemo, useState } from 'react';
import { Tabs, message } from 'antd';

import BankInfoForm from '../components/hiring/BankInfoForm';
import CoordinatorApprovalForm from '../components/hiring/CoordinatorApprovalForm';
import PersonalDetailsForm from '../components/hiring/PersonalDetailsForm';
import OwnedCard from '../components/ui/OwnedCard';
import OwnedPageHeader from '../components/ui/OwnedPageHeader';
import OwnedPageShell from '../components/ui/OwnedPageShell';

const stages = [
    { key: '1', title: 'Personal details', copy: 'Identity, contact, qualifications, and required uploads.' },
    { key: '2', title: 'Bank information', copy: 'Salary payment details and final confirmation.' },
    { key: '3', title: 'Coordinator review', copy: 'Final review, pay rate, and hiring decision.' },
];

function TechnicianHiring({ isSelfApply = false }) {
    const [activeTab, setActiveTab] = useState('1');
    const [applicationData, setApplicationData] = useState({
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
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolderName: '',
        bankInfoConfirmed: false,
        payRate: '',
        coordinatorId: '',
        coordinatorNotes: '',
        coordinatorApproved: false,
        id: null,
        applicationStatus: 'personal_details',
    });

    const stageIndex = useMemo(
        () => stages.findIndex((stage) => stage.key === activeTab),
        [activeTab],
    );

    const handleTabChange = (key) => {
        if (applicationData.bankInfoConfirmed && parseInt(key, 10) < 3) {
            message.warning('Cannot go back once application is submitted for coordinator review.');
            return;
        }

        if (key === '2' && !applicationData.personalDetailsConfirmed) {
            message.warning('Please confirm personal details first.');
            return;
        }

        if (key === '3' && !applicationData.bankInfoConfirmed) {
            message.warning('Please confirm bank information first.');
            return;
        }

        setActiveTab(key);
    };

    const updateApplicationData = (newData) => {
        setApplicationData((current) => ({ ...current, ...newData }));
    };

    const moveToNextTab = () => {
        setActiveTab((current) => (parseInt(current, 10) + 1).toString());
    };

    const moveToPreviousTab = () => {
        if (applicationData.bankInfoConfirmed) {
            message.warning('Cannot go back once application is submitted for coordinator review.');
            return;
        }

        setActiveTab((current) => (parseInt(current, 10) - 1).toString());
    };

    const headerDescription = isSelfApply
        ? 'Use the same hiring flow as the coordinator process. Complete each section in order and submit your details for review.'
        : 'Review and process technician applications through the existing three-stage workflow without changing the underlying approval logic.';

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            <OwnedPageShell>
                <OwnedPageHeader
                    eyebrow={isSelfApply ? 'Technician application' : 'Hiring'}
                    title={isSelfApply ? 'Apply as a technician' : 'Technician hiring'}
                    description={headerDescription}
                />

                <OwnedCard className="p-5 md:p-6 mb-6">
                    <div className="owned-step-row">
                        {stages.map((stage, index) => (
                            <div
                                key={stage.key}
                                className={`owned-step${index === stageIndex ? ' owned-step--active' : ''}`}
                            >
                                <span className="owned-step__index">{index + 1}</span>
                                <p className="owned-step__title">{stage.title}</p>
                                <p className="owned-step__copy">{stage.copy}</p>
                            </div>
                        ))}
                    </div>
                </OwnedCard>

                <OwnedCard className="p-5 md:p-6">
                    <div className="owned-inline-note mb-6">
                        {isSelfApply
                            ? 'Your application stays in the same real system flow: personal details, bank information, then coordinator review.'
                            : 'This page keeps the current coordinator hiring flow intact while improving readability and stage clarity.'}
                    </div>

                    <Tabs
                        activeKey={activeTab}
                        onChange={handleTabChange}
                        items={[
                            {
                                key: '1',
                                label: '1. Personal details',
                                children: (
                                    <PersonalDetailsForm
                                        applicationData={applicationData}
                                        updateApplicationData={updateApplicationData}
                                        moveToNextTab={moveToNextTab}
                                        isSelfApply={isSelfApply}
                                    />
                                ),
                            },
                            {
                                key: '2',
                                label: '2. Bank information',
                                disabled: !applicationData.personalDetailsConfirmed,
                                children: (
                                    <BankInfoForm
                                        applicationData={applicationData}
                                        updateApplicationData={updateApplicationData}
                                        moveToNextTab={moveToNextTab}
                                        moveToPreviousTab={moveToPreviousTab}
                                        isSelfApply={isSelfApply}
                                    />
                                ),
                            },
                            {
                                key: '3',
                                label: '3. Coordinator review',
                                disabled: !applicationData.bankInfoConfirmed,
                                children: isSelfApply ? (
                                    <OwnedCard className="p-5 md:p-6">
                                        <h3 className="owned-section-title">Submitted for coordinator review</h3>
                                        <p className="owned-section-copy">
                                            Your application has moved into the coordinator review stage. This page does not expose the approval actions because those stay in the coordinator-only workflow.
                                        </p>
                                        <div className="owned-inline-note mt-6">
                                            The coordinator will review your documents, bank details, and qualifications before deciding whether to create the technician account.
                                        </div>
                                    </OwnedCard>
                                ) : (
                                    <CoordinatorApprovalForm applicationData={applicationData} />
                                ),
                            },
                        ]}
                    />
                </OwnedCard>
            </OwnedPageShell>
        </div>
    );
}

export default TechnicianHiring;
