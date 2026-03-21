import React from 'react'
import { useNavigate } from 'react-router-dom';

const ThankYouPage = ({ driverInfo }) => {
  const navigate = useNavigate();
  const handleBackToHome = () => {
    navigate('/customer-dashboard')
  };
  return (
    <div className="app-bg">
      <main className="app-container">
        <div className="bg-white rounded-2xl overflow-hidden border border-black/10 shadow-sm p-8 md:p-12">
          <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
            {/* Success Icon */}
            <div className="mb-6">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <svg
                  className="w-12 h-12 md:w-16 md:h-16 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Thank You Message */}
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              Thank You!
            </h1>

            <p className="text-lg md:text-xl text-gray-700 mb-2">
              Your request has been successfully submitted
            </p>

            {driverInfo && (
              <div className="mt-6 p-6 bg-[#f5f1e8] rounded-xl w-full max-w-md">
                <p className="text-sm text-[var(--accent)] mb-2 font-medium">Driver Information</p>
                <p className="text-base font-semibold text-primary">
                  Truck ID: {driverInfo.truckId}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Phone: {driverInfo.phone}
                </p>
              </div>
            )}

            <p className="text-base text-gray-600 mt-8 mb-8">
              The driver has completed your pickup. Have a great day!
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full max-w-md">
              <button
                onClick={handleBackToHome}
                className="flex-1 bg-primary text-white px-8 py-3 rounded-2xl hover:opacity-95 active:scale-95 transition shadow-sm font-medium"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => window.location.href = driverInfo ? `tel:${driverInfo.phone}` : '#'}
                className="flex-1 border-2 border-primary text-primary px-8 py-3 rounded-2xl bg-transparent hover:bg-primary hover:text-white active:scale-95 transition font-medium"
              >
                Call Driver
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-10 pt-8 border-t border-gray-200 w-full">
              <p className="text-sm text-gray-500">
                Need help? Contact our support team
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ThankYouPage