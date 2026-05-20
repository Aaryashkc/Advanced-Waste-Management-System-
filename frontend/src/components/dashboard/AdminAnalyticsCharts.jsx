import React from "react";
import AnalyticsCharts from "./AnalyticsCharts";

// Org admin uses the same chart layout as super-admin, with `mode="admin"`
// so the breakdown bar shows top areas (within the org) instead of top orgs.
function AdminAnalyticsCharts({ analyticsData, billingSummary }) {
  return <AnalyticsCharts analyticsData={analyticsData} billingSummary={billingSummary} mode="admin" />;
}

export default AdminAnalyticsCharts;
