import React from 'react';
import { Link } from 'react-router-dom';
import { Recycle } from 'lucide-react';

const Navbar = () => {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
                <div className="flex justify-between items-center h-20">
                    <div className="flex items-center">
                        <Link to="/" className="text-2xl font-bold text-white flex items-center gap-2">
                            <Recycle className="w-7 h-7" />
                            <span>Safabin</span>
                        </Link>
                    </div>
                    <div className="flex items-center space-x-8">
                        <a href="#about" className="text-white/80 hover:text-white font-medium text-base transition-colors">About</a>
                        <Link
                            to="/login"
                            className="bg-white text-primary px-6 py-2.5 rounded-full font-medium text-base transition-colors hover:bg-accent"
                        >
                            Login
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
