import React from 'react';

function OwnedPageShell({ children, narrow = false, className = '' }) {
    const shellClass = `owned-page-shell${narrow ? ' owned-page-shell--narrow' : ''}${className ? ` ${className}` : ''}`;
    return <div className={shellClass}>{children}</div>;
}

export default OwnedPageShell;
