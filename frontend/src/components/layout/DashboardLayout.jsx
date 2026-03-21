import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../dashboard/Sidebar';
import Topbar from '../dashboard/Topbar';

const DashboardLayout = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Topbar />
            <Sidebar />

            <main className="pt-16 md:pl-64 min-h-screen transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
