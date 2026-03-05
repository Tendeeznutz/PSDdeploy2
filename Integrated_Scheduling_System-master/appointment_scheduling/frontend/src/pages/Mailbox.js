import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../axiosConfig";
import { Tabs, Badge, Modal, Input, Button, Empty, message, Select } from 'antd';
import { MailOutlined, SendOutlined, InboxOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { TabPane } = Tabs;

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

    // Get user info from localStorage
    const customerId = localStorage.getItem("customers_id");
    const customerName = localStorage.getItem("customers_name");
    const technicianId = localStorage.getItem("technicians_id");
    const technicianName = localStorage.getItem("technicians_name");
    const coordinatorId = localStorage.getItem("coordinators_id");
    const coordinatorName = localStorage.getItem("coordinators_name");

    // Determine user type and info
    const getUserInfo = () => {
        if (customerId) {
            return { userId: customerId, userType: 'customer', userName: customerName };
        } else if (technicianId) {
            return { userId: technicianId, userType: 'technician', userName: technicianName };
        } else if (coordinatorId) {
            return { userId: coordinatorId, userType: 'coordinator', userName: coordinatorName };
        }
        return null;
    };

    const userInfo = getUserInfo();

    // Compose message form state
    const [composeForm, setComposeForm] = useState({
        recipientType: 'coordinator',
        recipientId: '',
        recipientName: '',
        subject: '',
        body: ''
    });

    useEffect(() => {
        if (!userInfo) {
            navigate('/');
            return;
        }
        fetchMessages();
        fetchUnreadCount();

        // Fetch customers and technicians if user is a coordinator
        if (userInfo.userType === 'coordinator') {
            fetchCustomers();
            fetchTechnicians();
        }
    }, []);

    // Don't render if userInfo is null (redirect in progress)
    if (!userInfo) {
        return null;
    }

    const fetchMessages = async () => {
        setLoading(true);
        try {
            // Fetch inbox messages
            const inboxResponse = await api.get(
                `/api/messages/inbox/`,
                {
                    params: {
                        recipientId: userInfo.userId,
                        recipientType: userInfo.userType
                    }
                }
            );
            setInboxMessages(inboxResponse.data);

            // Fetch sent messages
            const sentResponse = await api.get(
                `/api/messages/sent/`,
                {
                    params: {
                        senderId: userInfo.userId,
                        senderType: userInfo.userType
                    }
                }
            );
            setSentMessages(sentResponse.data);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await api.get(
                `/api/messages/unread-count/`,
                {
                    params: {
                        recipientId: userInfo.userId,
                        recipientType: userInfo.userType
                    }
                }
            );
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const fetchCustomers = async () => {
        try {
            const response = await api.get(
                `/api/customers/`
            );
            setCustomers(response.data);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const fetchTechnicians = async () => {
        try {
            const response = await api.get(
                `/api/technicians/`
            );
            setTechnicians(response.data);
        } catch (error) {
            console.error('Error fetching technicians:', error);
        }
    };

    const handleMessageClick = async (message) => {
        setSelectedMessage(message);
        setShowMessageModal(true);

        // Mark as read if it's an inbox message and not already read
        if (activeTab === 'inbox' && !message.isRead) {
            try {
                await api.patch(
                    `/api/messages/${message.id}/mark-read/`
                );
                // Refresh messages and unread count
                fetchMessages();
                fetchUnreadCount();
            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        }
    };

    const handleComposeSubmit = async () => {
        if (!composeForm.subject || !composeForm.body) {
            message.warning('Please fill in subject and message body');
            return;
        }

        // Validate user info
        if (!userInfo || !userInfo.userId) {
            message.error('User information is missing. Please log in again.');
            navigate('/');
            return;
        }

        try {
            // Show loading message
            const loadingMessage = message.loading('Sending message...', 0);

            let messageData = {
                senderId: userInfo.userId,
                senderType: userInfo.userType,
                senderName: userInfo.userName || 'Unknown User',
                subject: composeForm.subject.trim(),
                body: composeForm.body.trim()
            };


            // For customers, backend will handle routing to coordinator and technician
            // For coordinators/technicians, they need to specify recipient
            if (userInfo.userType !== 'customer') {
                if (!composeForm.recipientId || !composeForm.recipientType) {
                    loadingMessage();
                    message.warning('Please select a recipient');
                    return;
                }
                messageData.recipientId = composeForm.recipientId;
                messageData.recipientType = composeForm.recipientType;
                messageData.recipientName = composeForm.recipientName;
            }

            const response = await api.post(
                `/api/messages/`,
                messageData
            );

            // Close loading message
            loadingMessage();

            // Reset form and close modal
            setComposeForm({
                recipientType: 'coordinator',
                recipientId: '',
                recipientName: '',
                subject: '',
                body: ''
            });
            setShowComposeModal(false);

            // Refresh messages
            fetchMessages();

            // Show success message
            if (userInfo.userType === 'customer' && response.data.count) {
                message.success(`Message sent successfully to ${response.data.count} recipient(s)!`);
            } else {
                message.success('Message sent successfully!');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMsg = error.response?.data?.error || 'Error sending message. Please try again.';
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
            minute: '2-digit'
        });
    };

    const handleBackToHome = () => {
        if (userInfo) {
            navigate(`/${userInfo.userType}/home`);
        } else {
            navigate('/');
        }
    };

    const renderMessageList = (messages, isInbox) => {
        if (messages.length === 0) {
            return (
                <Empty
                    description={isInbox ? "No messages in inbox" : "No sent messages"}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            );
        }

        return (
            <div className="space-y-2">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        onClick={() => handleMessageClick(message)}
                        className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition ${
                            isInbox && !message.isRead ? 'bg-blue-50 border-blue-200' : 'bg-white'
                        }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                {isInbox && !message.isRead && (
                                    <Badge status="processing" />
                                )}
                                <span className="font-semibold text-gray-900">
                                    {isInbox ? message.senderName : message.recipientName}
                                </span>
                            </div>
                            <span className="text-sm text-gray-500">
                                {formatDate(message.created_at)}
                            </span>
                        </div>
                        <div className="font-medium text-gray-800 mb-1">{message.subject}</div>
                        <div className="text-sm text-gray-600 truncate">
                            {message.body.substring(0, 100)}...
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 max-w-6xl">
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-4">
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={handleBackToHome}
                        size="medium"
                    >
                        Back to Home
                    </Button>
                </div>
                <div className="flex justify-between items-center mb-6" style={{ position: 'relative', zIndex: 1 }}>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <MailOutlined /> Mailbox
                    </h1>
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={() => setShowComposeModal(true)}
                        size="large"
                        style={{
                            opacity: 1,
                            visibility: 'visible',
                            display: 'inline-flex',
                            alignItems: 'center'
                        }}
                    >
                        Compose Message
                    </Button>
                </div>

                <Tabs activeKey={activeTab} onChange={setActiveTab}>
                    <TabPane
                        tab={
                            <span>
                                <InboxOutlined />
                                Inbox
                                {unreadCount > 0 && (
                                    <Badge count={unreadCount} style={{ marginLeft: 8 }} />
                                )}
                            </span>
                        }
                        key="inbox"
                    >
                        {loading ? (
                            <div className="text-center py-8">Loading...</div>
                        ) : (
                            renderMessageList(inboxMessages, true)
                        )}
                    </TabPane>
                    <TabPane
                        tab={
                            <span>
                                <SendOutlined />
                                Sent
                            </span>
                        }
                        key="sent"
                    >
                        {loading ? (
                            <div className="text-center py-8">Loading...</div>
                        ) : (
                            renderMessageList(sentMessages, false)
                        )}
                    </TabPane>
                </Tabs>
            </div>

            {/* View Message Modal */}
            <Modal
                title={selectedMessage?.subject}
                open={showMessageModal}
                onCancel={() => {
                    setShowMessageModal(false);
                    setSelectedMessage(null);
                }}
                footer={[
                    <Button key="close" onClick={() => setShowMessageModal(false)}>
                        Close
                    </Button>
                ]}
                width={700}
            >
                {selectedMessage && (
                    <div>
                        <div className="mb-4 pb-4 border-b">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <span className="font-semibold">From: </span>
                                    {selectedMessage.senderName} ({selectedMessage.senderType})
                                </div>
                                <span className="text-sm text-gray-500">
                                    {formatDate(selectedMessage.created_at)}
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold">To: </span>
                                {selectedMessage.recipientName} ({selectedMessage.recipientType})
                            </div>
                        </div>
                        <div className="whitespace-pre-wrap">{selectedMessage.body}</div>
                    </div>
                )}
            </Modal>

            {/* Compose Message Modal */}
            <Modal
                title="Compose New Message"
                open={showComposeModal}
                onOk={handleComposeSubmit}
                onCancel={() => {
                    setShowComposeModal(false);
                    setComposeForm({
                        recipientType: 'coordinator',
                        recipientId: '',
                        recipientName: '',
                        subject: '',
                        body: ''
                    });
                }}
                okText="Send Message"
                width={700}
            >
                <div className="space-y-4">
                    {userInfo.userType === 'customer' && (
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                            Messages will be sent to the coordinator team
                        </div>
                    )}

                    {userInfo.userType === 'coordinator' && (
                        <>
                            <div>
                                <label className="block mb-2 text-sm font-bold text-gray-700">
                                    Recipient Type
                                </label>
                                <Select
                                    style={{ width: '100%' }}
                                    placeholder="Select recipient type"
                                    value={composeForm.recipientType || undefined}
                                    onChange={(value) => {
                                        setComposeForm({
                                            ...composeForm,
                                            recipientType: value,
                                            recipientId: '',
                                            recipientName: ''
                                        });
                                    }}
                                >
                                    <Select.Option value="customer">Customer</Select.Option>
                                    <Select.Option value="technician">Technician</Select.Option>
                                </Select>
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-bold text-gray-700">
                                    Recipient
                                </label>
                                <Select
                                    style={{ width: '100%' }}
                                    placeholder={`Select ${composeForm.recipientType || 'recipient'}`}
                                    value={composeForm.recipientId || undefined}
                                    onChange={(value) => {
                                        const list = composeForm.recipientType === 'customer' ? customers : technicians;
                                        const selected = list.find(item => item.id === value);
                                        setComposeForm({
                                            ...composeForm,
                                            recipientId: value,
                                            recipientName: composeForm.recipientType === 'customer'
                                                ? selected?.customerName
                                                : selected?.technicianName
                                        });
                                    }}
                                    disabled={!composeForm.recipientType}
                                    showSearch
                                    filterOption={(input, option) =>
                                        option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                    }
                                >
                                    {composeForm.recipientType === 'customer'
                                        ? customers.map(customer => (
                                            <Select.Option key={customer.id} value={customer.id}>
                                                {customer.customerName}
                                            </Select.Option>
                                        ))
                                        : technicians.map(technician => (
                                            <Select.Option key={technician.id} value={technician.id}>
                                                {technician.technicianName}
                                            </Select.Option>
                                        ))
                                    }
                                </Select>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-700">
                            Subject
                        </label>
                        <Input
                            placeholder="Enter message subject"
                            value={composeForm.subject}
                            onChange={(e) =>
                                setComposeForm({ ...composeForm, subject: e.target.value })
                            }
                            maxLength={200}
                        />
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-700">
                            Message
                        </label>
                        <TextArea
                            rows={8}
                            placeholder="Enter your message"
                            value={composeForm.body}
                            onChange={(e) =>
                                setComposeForm({ ...composeForm, body: e.target.value })
                            }
                            maxLength={2000}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default Mailbox;
