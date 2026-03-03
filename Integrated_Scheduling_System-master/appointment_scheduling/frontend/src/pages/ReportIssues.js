// React example
import api from "../axiosConfig";
import { useState } from 'react';        
import {Card,Input,Checkbox,Button,Typography,} from "@material-tailwind/react";
import { useNavigate } from 'react-router-dom';

export default function ReportIssues() {
    const [issueTitle, setIssueTitle] = useState('');
    const [issueDescription, setIssueDescription] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            await api.post('/api/issues', {
                title: issueTitle,
                description: issueDescription,
            });
            alert('Issue reported successfully');
        } catch (error) {
            console.error('Error reporting issue:', error);
        }
    };

    const navigate = useNavigate();

    const goToReportIssues = () => {
        navigate('/home');
    }

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
            <form className="mt-8 mb-2 w-80 max-w-screen-lg sm:w-96">
                <div className="mb-1 flex flex-col gap-6">
                <Typography variant="h6" color="blue-gray" className="-mb-3">
                    Issue Title
                </Typography>
                <Input
                    size="lg"
                    placeholder="name@mail.com"
                    className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                    labelProps={{
                    className: "before:content-none after:content-none",
                    }}
                />
                <Typography variant="h6" color="blue-gray" className="-mb-3">
                    Issue Description
                </Typography>
                <Input
                    size="lg"
                    placeholder="name@mail.com"
                    className=" !border-t-blue-gray-200 focus:!border-t-gray-900"
                    labelProps={{
                    className: "before:content-none after:content-none",
                    }}
                />
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <button className='mt-6' onClick={goToReportIssues}>
                        Cancel
                    </button>
                    <Button className="mt-6">
                        Report Issue
                    </Button>
                </div>
                </form>
            </Card>
        </div>
    );
}