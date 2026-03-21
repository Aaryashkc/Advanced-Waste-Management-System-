import { useNavigate } from 'react-router-dom';
import { LogOut, Mail, Phone, Shield, Calendar, MapPin } from 'lucide-react';
import useAuthStore from '../stores/useAuthStore';
import { getDashboardRoute } from '../utils/roleRouting';

export default function Profile() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    if (!user) {
        navigate('/login', { replace: true });
        return null;
    }

    const initials = (user.name || 'U')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Resolve address — prefer top-level address, fallback to location.address
    const displayAddress = user.address || user.location?.address || null;

    return (
        <div className="bg-[#f5f1e8] min-h-screen py-12 px-4">
            <div className="max-w-xl mx-auto">
                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Banner */}
                    <div className="h-28 bg-gradient-to-br from-[#354f52] to-[#52796f]" />

                    {/* Avatar + Name */}
                    <div className="px-6 sm:px-8 pb-8 -mt-12">
                        <div className="w-24 h-24 bg-[#354f52] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-white mb-4">
                            {initials}
                        </div>

                        <h1 className="font-['Outfit',sans-serif] text-2xl font-bold text-[#354f52] mb-1">
                            {user.name}
                        </h1>
                        <span className="inline-block px-3 py-1 bg-[#354f52]/10 text-[#354f52] rounded-full text-xs font-semibold capitalize">
                            {user.role?.replace('_', ' ')}
                        </span>

                        {/* Info rows */}
                        <div className="mt-6 space-y-4">
                            {user.email && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Mail size={18} className="text-[#354f52] shrink-0" />
                                    <span className="text-sm">{user.email}</span>
                                </div>
                            )}
                            {user.phone && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Phone size={18} className="text-[#354f52] shrink-0" />
                                    <span className="text-sm">{user.phone}</span>
                                </div>
                            )}
                            {displayAddress && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <MapPin size={18} className="text-[#354f52] shrink-0" />
                                    <span className="text-sm">{displayAddress}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3 text-gray-600">
                                <Shield size={18} className="text-[#354f52] shrink-0" />
                                <span className="text-sm capitalize">Role: {user.role?.replace('_', ' ')}</span>
                            </div>
                            {user.orgId && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Calendar size={18} className="text-[#354f52] shrink-0" />
                                    <span className="text-sm">Org: {user.orgId}</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-8 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => navigate(getDashboardRoute(user.role))}
                                className="flex-1 inline-flex items-center justify-center px-5 py-3 bg-[#354f52] text-white font-semibold rounded-xl hover:bg-[#2a3f41] transition active:scale-[0.98]"
                            >
                                Go to Dashboard
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 border-2 border-red-500 text-red-500 font-semibold rounded-xl hover:bg-red-50 transition active:scale-[0.98]"
                            >
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
