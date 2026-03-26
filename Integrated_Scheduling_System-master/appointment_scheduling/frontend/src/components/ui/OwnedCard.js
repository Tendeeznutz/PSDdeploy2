import React from 'react';

function OwnedCard({ children, className = '', tone = 'default' }) {
    const toneClass = tone === 'soft' ? ' owned-card--soft' : tone === 'flat' ? ' owned-card--flat' : '';
    return <div className={`owned-card${toneClass}${className ? ` ${className}` : ''}`}>{children}</div>;
}

export default OwnedCard;
