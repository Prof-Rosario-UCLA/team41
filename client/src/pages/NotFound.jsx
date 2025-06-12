import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
    const navigate = useNavigate(); 

    const handleGoHome = () => {
        navigate('/games');
    };

    return (
        <div>
            <div>
                <h1>404</h1>
                <h2>Page Not Found</h2>
                <p>
                    Oops! The page you're looking for doesn't exist
                </p>
                <button
                    onClick={handleGoHome}
                >
                    Go to Games Menu
                </button>
            </div>
        </div>
    );
};

export default NotFoundPage;