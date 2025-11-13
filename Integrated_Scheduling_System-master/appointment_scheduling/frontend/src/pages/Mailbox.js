import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Tabs, Badge, Modal, Input, Button, Empty } from 'antd';
import { MailOutlined, SendOutlined, InboxOutlined } from '@ant-design/icons';

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
    }, []);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            // Fetch inbox messages
            const inboxResponse = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/messages/inbox/`,
                {
                    params: {
                        recipientId: userInfo.userId,
                        recipientType: userInfo.userType
                    }
                }
            );
            setInboxMessages(inboxResponse.data);

            // Fetch sent messages
            const sentResponse = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/messages/sent/`,
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
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/messages/unread-count/`,
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

    const handleMessageClick = async (message) => {
        setSelectedMessage(message);
        setShowMessageModal(true);

        // Mark as read if it's an inbox message and not already read
        if (activeTab === 'inbox' && !message.isRead) {
            try {
                await axios.patch(
                    `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/messages/${message.id}/mark-read/`
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
            alert('Please fill in subject and message body');
            return;
        }

        // For customers, always send to coordinator
        // For coordinators/technicians, need to select recipient
        let recipientInfo = composeForm;
        if (userInfo.userType === 'customer') {
            // Default to sending to coordinator (would need to fetch a coordinator ID)
            // For now, leaving as is - you may want to add coordinator selection
            recipientInfo = {
                ...composeForm,
                recipientType: 'coordinator'
            };
        }

        try {
            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/messages/`,
                {
                    senderId: userInfo.userId,
                    senderType: userInfo.userType,
                    senderName: userInfo.userName,
                    recipientId: recipientInfo.recipientId,
                    recipientType: recipientInfo.recipientType,
                    recipientName: recipientInfo.recipientName,
                    subject: composeForm.subject,
                    body: composeForm.body
                }
            );

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
            alert('Message sent successfully!');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Error sending message. Please try again.');
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
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <MailOutlined /> Mailbox
                    </h1>
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={() => setShowComposeModal(true)}
                        size="large"
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
