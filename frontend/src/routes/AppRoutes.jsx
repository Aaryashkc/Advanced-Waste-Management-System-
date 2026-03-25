import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Dashboard from "../pages/Dashboard";
import DashboardLayout from "../components/layout/DashboardLayout";
import HomePage from "../pages/HomePage";
import { Footer } from "../components/Headers/Footer";
import CustomerLoginPage from "../components/auth/CustomerLogin";
import { Header } from "../components/Headers/Header";
import CustomerSignUpPage from "../components/auth/CustomerSignup";
import OTPVerificationPage from "../components/auth/OTPVerificationPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import Unauthorized from "../pages/Unauthorized";
import AboutUs from "../pages/AboutUs";
import OurTeam from "../pages/OurTeam";
import ContactUs from "../pages/ContactUs";
import Profile from "../pages/Profile";
import CustomerLandingPage from "../components/users/CustomerLanding";
import CustomerDashboard from "../components/users/CustomerDashboard";
import SchedulePage from "../components/users/SchedulePage";
import UploadWastePage from "../components/users/UploadWastePage";
import SearchPage from "../components/sub-components/Searching";
import DriverDashboard from "../components/Driver/DriverDashboard";
import AcceptTaskPage from "../components/Driver/AcceptTaskPage";
import TaskRoutePage from "../components/Driver/TaskRoutePage";
import TaskFlow from "../components/Driver/TaskFlow";
import TestAnimationPage from "../pages/TestAnimationPage";
import MLScheduleDashboard from "../components/ml/MLScheduleDashboard";
import MLScheduleHistory from "../components/ml/MLScheduleHistory";
import DriverMLAssignments from "../components/ml/DriverMLAssignments";
import Vehicles from "../pages/Vehicles";
import Drivers from "../pages/Drivers";
import Organizations from "../pages/Organizations";
import OrgDetail from "../pages/OrgDetail";
import DriverDetail from "../pages/DriverDetail";
import Admins from "../pages/Admins";
import Areas from "../pages/Areas";
import Notifications from "../pages/Notifications";
import Reports from "../pages/Reports";
import PickupStats from "../pages/PickupStats";
import History from "../pages/History";
import PricingConfig from "../pages/PricingConfig";
import PickupStatusToast from "../components/users/PickupStatusToast";
import DriverStatusToast from "../components/Driver/DriverStatusToast";
import DriverNavbar from "../components/Driver/DriverNavbar";
import DriverNotifications from "../components/Driver/DriverNotifications";
import useAuthStore from "../stores/useAuthStore";

const AdminRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated && (user?.role === "super_admin" || user?.role === "admin")) {
    return <Navigate to="/admin-dashboard" replace />;
  }
  return <HomePage />;
};

const AppRoutes = () => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const isAdminRoute = location.pathname.startsWith("/admin-dashboard");
  const isDriverRoute = isAuthenticated && user?.role === "driver";

  return (
    <>
      {!isAdminRoute && !isDriverRoute && <Header />}

      <Routes>
        {/* Public Routes - admins get redirected to dashboard */}
        <Route path="/" element={<AdminRedirect />} />
        <Route path="/test-animation" element={<TestAnimationPage />} />
        <Route path="/login" element={
          isAuthenticated && (user?.role === "super_admin" || user?.role === "admin")
            ? <Navigate to="/admin-dashboard" replace />
            : <CustomerLoginPage />
        } />
        <Route path="/signup" element={<CustomerSignUpPage />} />
        <Route path="/otp-verification" element={<OTPVerificationPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Info Pages (accessible to logged-in customer_admin) */}
        <Route
          path="/about-us"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <AboutUs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/our-team"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <OurTeam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contact-us"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <ContactUs />
            </ProtectedRoute>
          }
        />

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
          path="/customer-landing"
          element={
            <ProtectedRoute allowedRoles={['customer_admin']}>
              <CustomerLandingPage />
            </ProtectedRoute>
          }
        />
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
          <Route path="organizations" element={<Organizations />} />
          <Route path="organizations/:orgId" element={<OrgDetail />} />
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

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isAdminRoute && !isDriverRoute && <Footer />}

      {/* Persistent status toast for customers */}
      {isAuthenticated && user?.role === "customer_admin" && <PickupStatusToast />}
      
      {/* Persistent driver navbar + status toast */}
      {isAuthenticated && user?.role === "driver" && <DriverNavbar />}
      {isAuthenticated && user?.role === "driver" && <DriverStatusToast />}
    </>
  );
};

export default AppRoutes;
