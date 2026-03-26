import React from 'react';

function OwnedPageHeader({ eyebrow, title, description, actions = null, className = '' }) {
    return (
        <div className={`owned-page-header${className ? ` ${className}` : ''}`}>
            <div className="owned-page-header__copy">
                {eyebrow ? <p className="owned-page-header__eyebrow">{eyebrow}</p> : null}
                <h1 className="owned-page-header__title">{title}</h1>
                {description ? <p className="owned-page-header__description">{description}</p> : null}
            </div>
            {actions ? <div>{actions}</div> : null}
        </div>
    );
}

export default OwnedPageHeader;
