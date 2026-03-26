import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeftOutlined,
    InboxOutlined,
    MailOutlined,
    SendOutlined,
} from '@ant-design/icons';
import {
    Badge,
    Button,
    Empty,
    Input,
    Modal,
    Select,
    Spin,
    Tabs,
    message,
} from 'antd';

import api from '../axiosConfig';
import OwnedCard from '../components/ui/OwnedCard';
import OwnedPageHeader from '../components/ui/OwnedPageHeader';
import OwnedPageShell from '../components/ui/OwnedPageShell';

const { TextArea } = Input;

function Mailbox() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('inbox');
    const [inboxMessages, setInboxMessages] = useState([]);
    const [sentMessages, setSentMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState([]);
    const [technicians, setTechnicians] = useState([]);

    const customerId = localStorage.getItem('customers_id');
    const customerName = localStorage.getItem('customers_name');
    const technicianId = localStorage.getItem('technicians_id');
    const technicianName = localStorage.getItem('technicians_name');
    const coordinatorId = localStorage.getItem('coordinators_id');
    const coordinatorName = localStorage.getItem('coordinators_name');

    const userInfo = useMemo(() => (
        customerId
            ? { userId: customerId, userType: 'customer', userName: customerName }
            : technicianId
                ? { userId: technicianId, userType: 'technician', userName: technicianName }
                : coordinatorId
                    ? { userId: coordinatorId, userType: 'coordinator', userName: coordinatorName }
                    : null
    ), [coordinatorId, coordinatorName, customerId, customerName, technicianId, technicianName]);

    const [composeForm, setComposeForm] = useState({
        recipientType: 'coordinator',
        recipientId: '',
        recipientName: '',
        subject: '',
        body: '',
    });

    const fetchMessages = useCallback(async () => {
        if (!userInfo) {
            return;
        }

        setLoading(true);
        try {
            const inboxResponse = await api.get('/api/messages/inbox/', {
                params: {
                    recipientId: userInfo.userId,
                    recipientType: userInfo.userType,
                },
            });
            setInboxMessages(inboxResponse.data);

            const sentResponse = await api.get('/api/messages/sent/', {
                params: {
                    senderId: userInfo.userId,
                    senderType: userInfo.userType,
                },
            });
            setSentMessages(sentResponse.data);
        } catch (fetchError) {
            console.error('Error fetching messages:', fetchError);
        } finally {
            setLoading(false);
        }
    }, [userInfo]);

    const fetchUnreadCount = useCallback(async () => {
        if (!userInfo) {
            return;
        }

        try {
            const response = await api.get('/api/messages/unread-count/', {
                params: {
                    recipientId: userInfo.userId,
                    recipientType: userInfo.userType,
                },
            });
            setUnreadCount(response.data.unreadCount);
        } catch (fetchError) {
            console.error('Error fetching unread count:', fetchError);
        }
    }, [userInfo]);

    const fetchCustomers = async () => {
        try {
            const response = await api.get('/api/customers/');
            setCustomers(response.data);
        } catch (fetchError) {
            console.error('Error fetching customers:', fetchError);
        }
    };

    const fetchTechnicians = async () => {
        try {
            const response = await api.get('/api/technicians/');
            setTechnicians(response.data);
        } catch (fetchError) {
            console.error('Error fetching technicians:', fetchError);
        }
    };

    useEffect(() => {
        if (!userInfo) {
            navigate('/');
            return;
        }

        fetchMessages();
        fetchUnreadCount();

        if (userInfo.userType === 'coordinator') {
            fetchCustomers();
            fetchTechnicians();
        }
    }, [fetchMessages, fetchUnreadCount, navigate, userInfo]);

    if (!userInfo) {
        return null;
    }

    const handleMessageClick = async (mailItem) => {
        setSelectedMessage(mailItem);
        setShowMessageModal(true);

        if (activeTab === 'inbox' && !mailItem.isRead) {
            try {
                await api.patch(`/api/messages/${mailItem.id}/mark-read/`);
                fetchMessages();
                fetchUnreadCount();
            } catch (readError) {
                console.error('Error marking message as read:', readError);
            }
        }
    };

    const handleComposeSubmit = async () => {
        if (!composeForm.subject || !composeForm.body) {
            message.warning('Please fill in the subject and message body.');
            return;
        }

        try {
            const loadingMessage = message.loading('Sending message...', 0);
            const messageData = {
                senderId: userInfo.userId,
                senderType: userInfo.userType,
                senderName: userInfo.userName || 'Unknown User',
                subject: composeForm.subject.trim(),
                body: composeForm.body.trim(),
            };

            if (userInfo.userType !== 'customer') {
                if (!composeForm.recipientId || !composeForm.recipientType) {
                    loadingMessage();
                    message.warning('Please select a recipient.');
                    return;
                }
                messageData.recipientId = composeForm.recipientId;
                messageData.recipientType = composeForm.recipientType;
                messageData.recipientName = composeForm.recipientName;
            }

            const response = await api.post('/api/messages/', messageData);
            loadingMessage();

            setComposeForm({
                recipientType: 'coordinator',
                recipientId: '',
                recipientName: '',
                subject: '',
                body: '',
            });
            setShowComposeModal(false);
            fetchMessages();

            if (userInfo.userType === 'customer' && response.data.count) {
                message.success(`Message sent successfully to ${response.data.count} recipient(s).`);
            } else {
                message.success('Message sent successfully.');
            }
        } catch (submitError) {
            console.error('Error sending message:', submitError);
            const errorMsg = submitError.response?.data?.error || 'Error sending message. Please try again.';
            message.error(errorMsg);
        }
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleBackToHome = () => {
        navigate(userInfo ? `/${userInfo.userType}/home` : '/');
    };

    const renderMessageList = (messages, isInbox) => {
        if (!messages.length) {
            return (
                <div className="py-8">
                    <Empty
                        description={isInbox ? 'No messages in your inbox yet.' : 'You have not sent any messages yet.'}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {messages.map((mailItem) => (
                    <div
                        key={mailItem.id}
                        onClick={() => handleMessageClick(mailItem)}
                        className={`owned-message-row${isInbox && !mailItem.isRead ? ' owned-message-row--unread' : ''}`}
                    >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    {isInbox && !mailItem.isRead ? <span className="owned-badge owned-badge--info">Unread</span> : null}
                                    {mailItem.relatedAppointment ? <span className="owned-badge owned-badge--warning">Booking linked</span> : null}
                                    <span className="text-sm font-semibold text-[#22252E]">
                                        {isInbox ? mailItem.senderName : mailItem.recipientName}
                                    </span>
                                </div>
                                <div className={`mt-3 text-base ${isInbox && !mailItem.isRead ? 'font-semibold text-[#22252E]' : 'font-medium text-[#1F2937]'}`}>
                                    {mailItem.subject}
                                </div>
                                <div className="mt-1 truncate text-sm text-[#6B7280]">
                                    {mailItem.body.substring(0, 120)}
                                </div>
                            </div>
                            <span className="shrink-0 text-sm text-[#7A7A85]">{formatDate(mailItem.created_at)}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const recipientOptions = composeForm.recipientType === 'customer' ? customers : technicians;

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            <OwnedPageShell>
                <OwnedPageHeader
                    eyebrow="Mailbox"
                    title="Messages and service updates"
                    description="Keep track of booking-related messages and contact the relevant team without dealing with a complex mail client."
                    actions={(
                        <div className="flex flex-wrap gap-3">
                            <Button icon={<ArrowLeftOutlined />} className="owned-secondary-button" onClick={handleBackToHome}>
                                Back to home
                            </Button>
                            <Button type="primary" icon={<SendOutlined />} className="owned-primary-button" onClick={() => setShowComposeModal(true)}>
                                Compose message
                            </Button>
                        </div>
                    )}
                />

                <OwnedCard className="p-5 md:p-6">
                    <div className="mb-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
                        <div className="owned-inline-note">
                            {userInfo.userType === 'customer'
                                ? 'Customer messages are routed to the coordinator team and, where available, the assigned technician for your latest booking.'
                                : 'Keep communication clear and action-focused so customers can follow updates without confusion.'}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                            <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                                <p className="text-sm font-semibold text-[#22252E]">Inbox</p>
                                <p className="mt-1 text-2xl font-extrabold text-[#4F81BD]">{inboxMessages.length}</p>
                            </div>
                            <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                                <p className="text-sm font-semibold text-[#22252E]">Unread</p>
                                <p className="mt-1 text-2xl font-extrabold text-[#22252E]">{unreadCount}</p>
                            </div>
                        </div>
                    </div>

                    <Tabs
                        className="owned-tabs"
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={[
                            {
                                key: 'inbox',
                                label: (
                                    <span className="owned-tab-label">
                                        <InboxOutlined className="owned-tab-label__icon" />
                                        <span>Inbox</span>
                                        {unreadCount > 0 ? <Badge count={unreadCount} style={{ marginInlineStart: 8 }} /> : null}
                                    </span>
                                ),
                                children: loading ? <div className="py-10 text-center"><Spin /></div> : renderMessageList(inboxMessages, true),
                            },
                            {
                                key: 'sent',
                                label: (
                                    <span className="owned-tab-label">
                                        <MailOutlined className="owned-tab-label__icon" />
                                        <span>Sent</span>
                                    </span>
                                ),
                                children: loading ? <div className="py-10 text-center"><Spin /></div> : renderMessageList(sentMessages, false),
                            },
                        ]}
                    />
                </OwnedCard>

                <Modal
                    title={selectedMessage?.subject}
                    open={showMessageModal}
                    onCancel={() => {
                        setShowMessageModal(false);
                        setSelectedMessage(null);
                    }}
                    footer={[
                        <Button key="close" className="owned-secondary-button" onClick={() => setShowMessageModal(false)}>
                            Close
                        </Button>,
                    ]}
                    width={720}
                >
                    {selectedMessage ? (
                        <div className="space-y-5 pt-1">
                            <div className="grid gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 text-sm text-[#6B7280] md:grid-cols-2">
                                <div>
                                    <p className="font-semibold text-[#22252E]">From</p>
                                    <p className="mt-1">{selectedMessage.senderName} ({selectedMessage.senderType})</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-[#22252E]">Received</p>
                                    <p className="mt-1">{formatDate(selectedMessage.created_at)}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-[#22252E]">To</p>
                                    <p className="mt-1">{selectedMessage.recipientName} ({selectedMessage.recipientType})</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-[#22252E]">Message type</p>
                                    <p className="mt-1">{selectedMessage.relatedAppointment ? 'Booking-linked update' : 'General support message'}</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 whitespace-pre-wrap text-sm leading-7 text-[#1F2937]">
                                {selectedMessage.body}
                            </div>
                        </div>
                    ) : null}
                </Modal>

                <Modal
                    title="Compose message"
                    open={showComposeModal}
                    onOk={handleComposeSubmit}
                    onCancel={() => {
                        setShowComposeModal(false);
                        setComposeForm({
                            recipientType: 'coordinator',
                            recipientId: '',
                            recipientName: '',
                            subject: '',
                            body: '',
                        });
                    }}
                    okText="Send message"
                    okButtonProps={{ className: 'owned-primary-button' }}
                    cancelButtonProps={{ className: 'owned-secondary-button' }}
                    width={720}
                >
                    <div className="space-y-5 pt-1">
                        {userInfo.userType === 'customer' ? (
                            <div className="owned-inline-note">
                                Your message will be sent to the coordinator team and, when applicable, the technician assigned to your most recent booking.
                            </div>
                        ) : null}

                        {userInfo.userType === 'coordinator' ? (
                            <div className="owned-form-grid">
                                <div className="owned-field">
                                    <label className="owned-field__label">Recipient type</label>
                                    <Select
                                        className="owned-input"
                                        placeholder="Select recipient type"
                                        value={composeForm.recipientType || undefined}
                                        onChange={(value) => {
                                            setComposeForm({
                                                ...composeForm,
                                                recipientType: value,
                                                recipientId: '',
                                                recipientName: '',
                                            });
                                        }}
                                        options={[
                                            { value: 'customer', label: 'Customer' },
                                            { value: 'technician', label: 'Technician' },
                                        ]}
                                    />
                                </div>
                                <div className="owned-field">
                                    <label className="owned-field__label">Recipient</label>
                                    <Select
                                        className="owned-input"
                                        placeholder={`Select ${composeForm.recipientType || 'recipient'}`}
                                        value={composeForm.recipientId || undefined}
                                        disabled={!composeForm.recipientType}
                                        showSearch
                                        filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
                                        onChange={(value) => {
                                            const selected = recipientOptions.find((item) => item.id === value);
                                            setComposeForm({
                                                ...composeForm,
                                                recipientId: value,
                                                recipientName: composeForm.recipientType === 'customer' ? selected?.customerName : selected?.technicianName,
                                            });
                                        }}
                                        options={recipientOptions.map((item) => ({
                                            value: item.id,
                                            label: composeForm.recipientType === 'customer' ? item.customerName : item.technicianName,
                                        }))}
                                    />
                                </div>
                            </div>
                        ) : null}

                        <div className="owned-field">
                            <label className="owned-field__label">Subject</label>
                            <Input
                                className="owned-input"
                                placeholder="Enter a short subject"
                                value={composeForm.subject}
                                onChange={(event) => setComposeForm({ ...composeForm, subject: event.target.value })}
                                maxLength={200}
                            />
                        </div>

                        <div className="owned-field">
                            <label className="owned-field__label">Message</label>
                            <TextArea
                                className="owned-input"
                                rows={8}
                                placeholder="Write your message"
                                value={composeForm.body}
                                onChange={(event) => setComposeForm({ ...composeForm, body: event.target.value })}
                                maxLength={2000}
                            />
                        </div>
                    </div>
                </Modal>
            </OwnedPageShell>
        </div>
    );
}

export default Mailbox;
