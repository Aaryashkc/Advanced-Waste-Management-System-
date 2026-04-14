import React from "react";
import AnalyticsCharts from "./AnalyticsCharts";

// Org admin uses the same chart layout as super-admin, with `mode="admin"`
// so the breakdown bar shows top areas (within the org) instead of top orgs.
function AdminAnalyticsCharts({ analyticsData }) {
  return <AnalyticsCharts analyticsData={analyticsData} mode="admin" />;
}

export default AdminAnalyticsCharts;
