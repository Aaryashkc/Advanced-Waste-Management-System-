import { ArrowRight, LogOut, Menu, X, User, ChevronDown } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import useAuthStore from "../../stores/useAuthStore";
import { getNavLinks } from "../../utils/roleRouting";

export function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    setProfileOpen(false);
    navigate("/login", { replace: true });
  };

  const navLinks = isAuthenticated && user ? getNavLinks(user.role) : [];

  // ── Logged-out header ──
  if (!isAuthenticated) {
    return (
      <header className="bg-[#354f52] w-full">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 sm:h-[72px] items-center justify-between">
            <Link
              to="/"
              className="text-white font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-tight"
              aria-label="SafaBin home"
            >
              SafaBin
            </Link>

            <div className="flex items-center gap-2 sm:gap-3 md:gap-6">
              <Link
                to="/signup"
                className="hidden sm:inline-flex items-center justify-center rounded-full border border-white/60 px-4 py-2 text-sm sm:text-base font-medium text-white hover:bg-white/10 transition"
              >
                Sign Up
              </Link>

              <Link
                to="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 sm:px-5 md:px-7 py-2 sm:py-2.5 text-sm sm:text-base md:text-lg font-semibold text-[#354f52] hover:bg-white/90 transition active:scale-[0.98]"
              >
                Log In
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Logged-in header ──
  return (
    <header className="bg-[#354f52] w-full relative z-50">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid h-16 sm:h-[72px] grid-cols-[auto_1fr_auto] items-center gap-4">
          {/* Brand */}
          <Link
            to="/"
            className="text-white font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-tight"
            aria-label="SafaBin home"
          >
            SafaBin
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center justify-center gap-1 lg:gap-2 min-w-0">
            {navLinks.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === navLinks[0]?.path}
                className={({ isActive }) =>
                  `px-3 lg:px-4 py-2 rounded-full text-sm lg:text-base font-medium transition-colors ${isActive
                    ? "bg-white/20 text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User menu (desktop) */}
          <div className="hidden md:flex items-center justify-end gap-3">
            {/* Profile dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                {/* Avatar */}
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-semibold leading-tight">
                    {user?.name || "User"}
                  </p>
                  <p className="text-white/60 text-xs capitalize">
                    {user?.role?.replace("_", " ")}
                  </p>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-white/60 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-[fadeIn_0.15s_ease-out]">
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <User size={16} className="text-[#354f52]" />
                    My Profile
                  </Link>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition w-full text-left"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden justify-self-end text-white p-2 hover:bg-white/10 rounded-lg transition"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-white/20 mt-1 pt-3 space-y-1">
            {navLinks.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === navLinks[0]?.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive
                    ? "bg-white/20 text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}

            {/* Mobile user section */}
            <div className="mt-3 pt-3 border-t border-white/20 px-4 space-y-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {initials}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">
                    {user?.name || "User"}
                  </p>
                  <p className="text-white/60 text-xs capitalize">
                    {user?.role?.replace("_", " ")}
                  </p>
                </div>
              </div>

              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition"
              >
                My Profile
              </Link>
              <button
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/60 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/10 transition"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
