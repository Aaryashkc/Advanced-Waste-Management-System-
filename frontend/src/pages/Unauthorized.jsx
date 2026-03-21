import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';
import { getDashboardRoute } from '../utils/roleRouting';

const Unauthorized = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuthStore();

    const handleGoBack = () => {
        if (isAuthenticated && user) {
            navigate(getDashboardRoute(user.role), { replace: true });
        } else {
            navigate('/login', { replace: true });
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                {/* Icon */}
                <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>

                <h1 className="font-['Outfit',sans-serif] text-3xl sm:text-4xl font-bold text-[#354f52] mb-3">
                    Access Denied
                </h1>

                <p className="font-['Poppins',sans-serif] text-base text-gray-600 mb-2">
                    You don't have permission to access this page.
                </p>

                {user && (
                    <p className="font-['Poppins',sans-serif] text-sm text-gray-500 mb-8">
                        Your role: <span className="font-semibold capitalize">{user.role?.replace('_', ' ')}</span>
                    </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={handleGoBack}
                        className="inline-flex items-center justify-center px-6 py-3 bg-[#354f52] text-white font-semibold rounded-xl hover:bg-[#2a3f41] transition-colors focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2"
                    >
                        {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
                    </button>

                    {isAuthenticated && (
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center justify-center px-6 py-3 border-2 border-[#354f52] text-[#354f52] font-semibold rounded-xl hover:bg-[#354f52]/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2"
                        >
                            Logout
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;
