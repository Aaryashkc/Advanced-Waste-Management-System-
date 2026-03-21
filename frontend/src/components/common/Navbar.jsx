import React from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';

const Navbar = () => {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                        <Link to="/" className="text-2xl font-bold text-green-700 flex items-center gap-2">
                            <span>♻️</span>
                            <span>Safabin</span>
                        </Link>
                    </div>
                    <div className="hidden md:flex items-center space-x-8">

                        <a href="#about" className="text-gray-600 hover:text-green-700 font-medium">About</a>
                        <Link to="/login">
                            <Button variant="primary">Admin Login</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
