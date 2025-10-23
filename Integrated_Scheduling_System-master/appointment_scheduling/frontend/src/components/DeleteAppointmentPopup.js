// DeleteAppointmentPopup.js

import React from 'react';
import { Modal, Button } from 'antd';

const DeleteAppointmentPopup = ({ visible, onCancel, onConfirmDelete }) => {
    return (
        <Modal
            visible={visible}
            title="Confirm Delete"
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button key="delete" type="primary" style={{ color: 'black' }} onClick={onConfirmDelete}>
                    Confirm Delete
                </Button>,
            ]}
        >
            <p>Are you sure you want to delete this appointment?</p>
        </Modal>
    );
};

export default DeleteAppointmentPopup;
