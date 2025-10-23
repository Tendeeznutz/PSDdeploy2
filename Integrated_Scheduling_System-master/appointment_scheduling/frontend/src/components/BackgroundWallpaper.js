import React from 'react';
import backgroundImage from '../asset/img/aircon_bg.jpeg'; // replace this with your actual background image path

function Background({ children }) {
    return (
        <div style={{
            background: `rgba(255, 255, 255, 0.7) url(${backgroundImage})`, // Adjust the alpha value (0.7) as needed
            backgroundSize: 'cover',
            height: '100vh',
            width: '100%',
            backgroundRepeat: 'no-repeat',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative', // Necessary for overlay
            opacity: 1,
            zIndex: 1
        }}>
            {children}
        </div>
    );
}

export default Background;
