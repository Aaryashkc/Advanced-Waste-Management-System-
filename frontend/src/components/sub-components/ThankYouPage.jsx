import React from "react";
import { useNavigate } from "react-router-dom";

const ThankYouPage = ({ driverInfo }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f7f4ed] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-lg border border-primary/8 overflow-hidden max-w-lg w-full">

        {/* Green header band */}
        <div className="bg-gradient-to-br from-[#296200] to-[#3a8a00] px-8 py-10 text-center">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1.5">Thank You!</h1>
          <p className="text-white/80 text-sm">Your pickup has been completed successfully</p>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">

          {/* Driver info */}
          {driverInfo && (
            <div className="rounded-2xl border border-primary/8 overflow-hidden">
              <div className="px-5 py-3 bg-primary/3 border-b border-primary/5">
                <p className="text-xs font-bold text-primary/50 uppercase tracking-wider">Driver Details</p>
              </div>
              <div className="divide-y divide-primary/5">
                {driverInfo.name && (
                  <div className="px-5 py-3.5 flex items-center justify-between">
                    <span className="text-xs text-primary/50 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Name
                    </span>
                    <span className="text-sm font-semibold text-primary">{driverInfo.name}</span>
                  </div>
                )}
                {driverInfo.phone && (
                  <div className="px-5 py-3.5 flex items-center justify-between">
                    <span className="text-xs text-primary/50 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Phone
                    </span>
                    <span className="text-sm font-semibold text-primary">{driverInfo.phone}</span>
                  </div>
                )}
                {(driverInfo.truckId || driverInfo.licensePlate) && (
                  <div className="px-5 py-3.5 flex items-center justify-between">
                    <span className="text-xs text-primary/50 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H3m10 0h2m0 0V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16h-2" />
                      </svg>
                      Vehicle
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      {[driverInfo.truckId, driverInfo.licensePlate].filter(Boolean).join(" \u00B7 ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-sm text-primary/50">
            Your waste has been collected. Thank you for keeping your community clean!
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/customer-dashboard")}
              className="flex-1 py-3 bg-[#296200] text-white font-semibold rounded-2xl hover:bg-[#245400] active:scale-[0.97] transition-all shadow-md shadow-[#296200]/20 text-sm"
            >
              Back to Dashboard
            </button>
            {driverInfo?.phone && (
              <a
                href={`tel:${driverInfo.phone}`}
                className="flex-1 py-3 border-2 border-primary/15 text-primary font-semibold rounded-2xl hover:bg-primary/5 active:scale-[0.97] transition-all text-center text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Driver
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;
