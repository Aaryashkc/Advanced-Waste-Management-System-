import { ArrowRight, LogOut, Menu, X, User, ChevronDown } from "lucide-react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import useAuthStore from "../../stores/useAuthStore";
import { getNavLinks } from "../../utils/roleRouting";

export function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef(null);

  const isLandingPage = location.pathname === "/";

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    setProfileOpen(false);
    navigate("/login", { replace: true });
  };

  const navLinks = isAuthenticated && user ? getNavLinks(user.role) : [];

  // Determine header style based on scroll and page
  const isTransparent = isLandingPage && !scrolled && !mobileOpen;
  const headerBg = isTransparent
    ? "bg-transparent"
    : "bg-primary backdrop-blur-md";

  // ── Logged-out header ──
  if (!isAuthenticated) {
    return (
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}
      >
        <div className="mx-auto max-w-7xl px-6 md:px-16 lg:px-24">
          <div className="flex h-18 items-center justify-between">
            <Link
              to="/"
              className="text-white font-extrabold text-2xl tracking-tight "
              aria-label="SafaBin home"
            >
              SafaBin
            </Link>

            {/* Desktop nav — center links */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              <a
                href="#features"
                className="px-3 lg:px-4 py-2 rounded-full text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#services"
                className="px-3 lg:px-4 py-2 rounded-full text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                Services
              </a>
              <a
                href="#faq"
                className="px-3 lg:px-4 py-2 rounded-full text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                FAQ
              </a>
            </nav>

            {/* Desktop nav — right actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/signup"
                className="text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-primary hover:bg-accent transition-colors"
              >
                Log In
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-white p-2 rounded-lg transition cursor-pointer"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-primary border-t border-white/10">
            <div className="px-6 py-6 space-y-1">
              <a
                href="#features"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-xl text-white/80 text-base  font-medium"
              >
                Features
              </a>
              <a
                href="#services"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-xl text-white/80 text-base  font-medium"
              >
                Services
              </a>
              <a
                href="#faq"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-xl text-white/80 text-base  font-medium"
              >
                FAQ
              </a>
              <div className="pt-4 border-t border-white/10 mt-4 space-y-3">
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-full border border-white/30 text-white text-base font-medium "
                >
                  Sign Up
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-full bg-white text-primary text-base font-semibold "
                >
                  Log In
                </Link>
              </div>
            </div>
          </div>
        )}
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
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-16 lg:px-24">
        <div className="flex h-18 items-center justify-between">
          {/* Brand */}
          <Link
            to="/"
            className="text-white font-extrabold text-2xl tracking-tight "
            aria-label="SafaBin home"
          >
            SafaBin
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === navLinks[0]?.path}
                className={({ isActive }) =>
                  `px-3 lg:px-4 py-2 rounded-full text-sm font-medium  transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:text-white"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User menu (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-white text-sm font-semibold leading-tight">
                    {user?.name || "User"}
                  </p>
                  <p className="text-white/50 text-xs capitalize">
                    {user?.role?.replace("_", " ")}
                  </p>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-white/50 transition-transform duration-200 ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-gray-100 py-2">
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <User size={16} className="text-primary" />
                    My Profile
                  </Link>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition w-full text-left cursor-pointer"
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
            className="md:hidden text-white p-2 rounded-lg transition cursor-pointer"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile nav (logged in) */}
      {mobileOpen && (
        <div className="md:hidden bg-primary border-t border-white/10">
          <div className="px-6 py-6 space-y-1">
            {navLinks.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === navLinks[0]?.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-xl text-base font-medium  transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-white/80"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}

            <div className="pt-4 mt-4 border-t border-white/10">
              <div className="flex items-center gap-3 px-4 mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {initials}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">
                    {user?.name || "User"}
                  </p>
                  <p className="text-white/50 text-xs capitalize">
                    {user?.role?.replace("_", " ")}
                  </p>
                </div>
              </div>

              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center px-4 py-3 rounded-full border border-white/30 text-white text-sm font-medium  mb-3"
              >
                My Profile
              </Link>
              <button
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-red-400/40 px-4 py-3 text-sm font-medium text-red-300 cursor-pointer"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
