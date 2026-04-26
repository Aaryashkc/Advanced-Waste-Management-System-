import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import DashboardLayout from "../components/layout/DashboardLayout";
import { Footer } from "../components/Headers/Footer";
import { Header } from "../components/Headers/Header";
// OTP is now handled via modal inside Login/Signup pages
import ProtectedRoute from "../components/auth/ProtectedRoute";
import useAuthStore from "../stores/useAuthStore";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const HomePage = lazy(() => import("../pages/HomePage"));
const CustomerLoginPage = lazy(() => import("../components/auth/CustomerLogin"));
const CustomerSignUpPage = lazy(() => import("../components/auth/CustomerSignup"));
const Unauthorized = lazy(() => import("../pages/Unauthorized"));
const AboutUs = lazy(() => import("../pages/AboutUs"));
const OurTeam = lazy(() => import("../pages/OurTeam"));
const ContactUs = lazy(() => import("../pages/ContactUs"));
const Profile = lazy(() => import("../pages/Profile"));
const CustomerDashboard = lazy(() => import("../components/users/CustomerDashboard"));
const SchedulePage = lazy(() => import("../components/users/SchedulePage"));
const UploadWastePage = lazy(() => import("../components/users/UploadWastePage"));
const SearchPage = lazy(() => import("../components/sub-components/Searching"));
const PaymentSuccessPage = lazy(() => import("../components/sub-components/PaymentSuccessPage"));
const DriverDashboard = lazy(() => import("../components/Driver/DriverDashboard"));
const AcceptTaskPage = lazy(() => import("../components/Driver/AcceptTaskPage"));
const TaskRoutePage = lazy(() => import("../components/Driver/TaskRoutePage"));
const TaskFlow = lazy(() => import("../components/Driver/TaskFlow"));
const MLScheduleDashboard = lazy(() => import("../components/ml/MLScheduleDashboard"));
const MLScheduleHistory = lazy(() => import("../components/ml/MLScheduleHistory"));
const DriverMLAssignments = lazy(() => import("../components/ml/DriverMLAssignments"));
const Vehicles = lazy(() => import("../pages/Vehicles"));
const Drivers = lazy(() => import("../pages/Drivers"));
const Organizations = lazy(() => import("../pages/Organizations"));
const OrgDetail = lazy(() => import("../pages/OrgDetail"));
const DriverDetail = lazy(() => import("../pages/DriverDetail"));
const Admins = lazy(() => import("../pages/Admins"));
const Areas = lazy(() => import("../pages/Areas"));
const Notifications = lazy(() => import("../pages/Notifications"));
const Reports = lazy(() => import("../pages/Reports"));
const Users = lazy(() => import("../pages/Users"));
const PickupStats = lazy(() => import("../pages/PickupStats"));
const History = lazy(() => import("../pages/History"));
const PricingConfig = lazy(() => import("../pages/PricingConfig"));
const BillingPage = lazy(() => import("../components/users/BillingPage"));
const BillingOverview = lazy(() => import("../pages/BillingOverview"));
const AdminBilling = lazy(() => import("../pages/AdminBilling"));
const AdminContact = lazy(() => import("../pages/AdminContact"));
const PickupStatusToast = lazy(() => import("../components/users/PickupStatusToast"));
const DriverStatusToast = lazy(() => import("../components/Driver/DriverStatusToast"));
const DriverNavbar = lazy(() => import("../components/Driver/DriverNavbar"));
const DriverNotifications = lazy(() => import("../components/Driver/DriverNotifications"));
const ScheduleToast = lazy(() => import("../components/ml/ScheduleToast"));
const DebugScheduleData = lazy(() => import("../components/debug/DebugScheduleData"));
const HelpSupportPage = lazy(() => import("../pages/HelpandSupport"));

const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-primary">
    Loading...
  </div>
);

const AdminRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated && (user?.role === "super_admin" || user?.role === "admin")) {
    return <Navigate to="/admin-dashboard" replace />;
  }
  return <HomePage />;
};

const DashboardBillingRoute = () => {
  const { user } = useAuthStore();
  if (user?.role === "super_admin") return <BillingOverview />;
  return <AdminBilling />;
};

const CustomerBillingRoute = () => {
  const { user } = useAuthStore();
  if (user?.role === "admin") return <Navigate to="/admin-dashboard/billing" replace />;
  return (
    <ProtectedRoute allowedRoles={['customer_admin']}>
      <BillingPage />
    </ProtectedRoute>
  );
};

const AppRoutes = () => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const isAdminRoute = location.pathname.startsWith("/admin-dashboard");
  const isDriverRoute = isAuthenticated && user?.role === "driver";

  return (
    <>
      {!isAdminRoute && !isDriverRoute && <Header />}

      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public Routes - admins get redirected to dashboard */}
        <Route path="/" element={<AdminRedirect />} />
        <Route path="/login" element={
          isAuthenticated && (user?.role === "super_admin" || user?.role === "admin")
            ? <Navigate to="/admin-dashboard" replace />
            : <CustomerLoginPage />
        } />
        <Route path="/signup" element={<CustomerSignUpPage />} />
        <Route path="/help-support" element={<HelpSupportPage />} />
        <Route path="/otp-verification" element={<Navigate to="/login" replace />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Info Pages (accessible to everyone) */}
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/our-team" element={<OurTeam />} />
        <Route path="/contact-us" element={<ContactUs />} />

        {/* Profile (all authenticated users) */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'customer_admin', 'driver']}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Protected Customer Admin Routes */}
        <Route
          path="/customer-dashboard"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <SchedulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload-waste"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <UploadWastePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-success"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <PaymentSuccessPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-failed"
          element={<Navigate to="/customer-dashboard?paymentFailed=1" replace />}
        />
        <Route
          path="/billing"
          element={<CustomerBillingRoute />}
        />
        <Route
          path="/searching"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <SearchPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Driver Routes */}
        <Route
          path="/driver-dashboard"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accept-task"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <AcceptTaskPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/task-route/:pickupId"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <TaskRoutePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/task-flow/:pickupId"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <TaskFlow />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver-ml-assignments"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverMLAssignments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver-notifications"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverNotifications />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Routes (super_admin and admin) */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="organizations" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Organizations />
            </ProtectedRoute>
          } />
          <Route path="organizations/:orgId" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <OrgDetail />
            </ProtectedRoute>
          } />
          <Route path="my-organization" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <OrgDetail myOrganization />
            </ProtectedRoute>
          } />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:driverId" element={<DriverDetail />} />
          <Route path="admins" element={<Admins />} />
          <Route path="areas" element={<Areas />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="ml-schedule" element={<MLScheduleDashboard />} />
          <Route path="ml-schedule/history" element={<MLScheduleHistory />} />
          <Route path="history" element={<History />} />
          <Route path="pricing" element={<PricingConfig />} />
          <Route path="billing" element={<DashboardBillingRoute />} />
          <Route path="contact" element={<AdminContact />} />
          <Route path="users" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="pickup-stats" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <PickupStats />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Reports />
            </ProtectedRoute>
          } />
        </Route>

        {/* Debug Route - for testing */}
        <Route path="/debug-schedule" element={<DebugScheduleData />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>

      {!isAdminRoute && !isDriverRoute && <Footer />}

      <Suspense fallback={null}>
      {/* Persistent status toast for customers */}
      {isAuthenticated && user?.role === "customer_admin" && <PickupStatusToast />}
      
      {/* Persistent driver navbar + status toast */}
      {isAuthenticated && user?.role === "driver" && <DriverNavbar />}
      {isAuthenticated && user?.role === "driver" && <DriverStatusToast />}

      {/* Schedule toast — works for drivers, admins, and super_admins */}
      {isAuthenticated && <ScheduleToast />}
      </Suspense>
    </>
  );
};

export default AppRoutes;
