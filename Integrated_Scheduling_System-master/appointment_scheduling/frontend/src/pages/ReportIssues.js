import api from "../axiosConfig";
import { useState } from 'react';
import {Card,Input,Button,Typography,} from "@material-tailwind/react";
import { useNavigate } from 'react-router-dom';

export default function ReportIssues() {
    const [issueTitle, setIssueTitle] = useState('');
    const [issueDescription, setIssueDescription] = useState('');

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            await api.post('/api/messages/', {
                subject: issueTitle,
                body: issueDescription,
                senderType: 'customer',
                senderId: localStorage.getItem('customers_id'),
                recipientType: 'coordinator',
            });
            alert('Issue reported successfully');
            navigate('/customer/home');
        } catch (error) {
            console.error('Error reporting issue:', error);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '70vh'
            }}>
            <Card color="transparent" shadow={false}>
            <Typography variant="h4" color="blue-gray">
                Report Issues
            </Typography>
            <Typography color="gray" className="mt-1 font-normal">
                Describe the issue you are experiencing
            </Typography>
            <form onSubmit={handleSubmit} className="mt-8 mb-2 w-80 max-w-screen-lg sm:w-96">
                <div className="mb-1 flex flex-col gap-6">
                <Typography variant="h6" color="blue-gray" className="-mb-3">
                    Issue Title
                </Typography>
                <Input
                    size="lg"
                    placeholder="Enter issue title"
                    className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                    labelProps={{
                    className: "before:content-none after:content-none",
                    }}
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    required
                />
                <Typography variant="h6" color="blue-gray" className="-mb-3">
                    Issue Description
                </Typography>
                <Input
                    size="lg"
                    placeholder="Describe the issue"
                    className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                    labelProps={{
                    className: "before:content-none after:content-none",
                    }}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    required
                />
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <button className='mt-6' type="button" onClick={() => navigate('/customer/home')}>
                        Cancel
                    </button>
                    <Button className="mt-6" type="submit">
                        Report Issue
                    </Button>
                </div>
                </form>
            </Card>
        </div>
    );
}
