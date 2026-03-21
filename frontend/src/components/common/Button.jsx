import React from 'react';

const Button = ({
    children,
    variant = 'primary',
    className = '',
    type = 'button',
    onClick,
    ...props
}) => {
    const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2";

    const variants = {
        primary: "bg-green-700 hover:bg-green-800 text-white focus:ring-green-700",
        secondary: "bg-white text-green-700 border border-green-700 hover:bg-green-50 focus:ring-green-700",
        outline: "bg-transparent text-gray-600 hover:text-green-700 hover:bg-gray-50",
        danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
    };

    return (
        <button
            type={type}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            onClick={onClick}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
