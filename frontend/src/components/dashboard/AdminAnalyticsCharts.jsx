import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AdminAnalyticsCharts = ({ analyticsData }) => {
  const {
    organizationData = [], // Now holds drivers data
    timeSeriesDataRaw = [],
    wasteTypeDistribution = [],
    taskStatusDistribution = []
  } = analyticsData || {};

  // 1. Process Time Series Data
  const timeSeriesData = useMemo(() => {
    const labels = timeSeriesDataRaw.map(item => item.date);
    const data = timeSeriesDataRaw.map(item => item.dailyWaste);
    
    return { 
      labels, 
      datasets: [
        {
          label: 'Total Collected (kg)',
          data,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.2)',
          tension: 0.4,
          fill: true
        }
      ] 
    };
  }, [timeSeriesDataRaw]);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#2d3748',
          font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(25, 42, 28, 0.9)',
        titleFont: { family: "'Inter', sans-serif", size: 14 },
        bodyFont: { family: "'Inter', sans-serif", size: 13 },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: "'Inter', sans-serif" }, color: '#4a5568' }
      },
      y: {
        border: { dash: [4, 4] },
        grid: { color: '#e2e8f0' },
        ticks: { font: { family: "'Inter', sans-serif" }, color: '#4a5568' },
        beginAtZero: true
      }
    }
  };

  // 1. Bar Chart: Total Waste by Driver
  const barData = {
    labels: organizationData.map(d => d.name),
    datasets: [
      {
        label: 'Total Waste Collected (kg)',
        data: organizationData.map(d => d.wasteCollectedField),
        backgroundColor: [
          'rgba(74, 222, 128, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderRadius: 8,
      }
    ]
  };

  const lineOptions = {
    ...commonOptions,
    interaction: { mode: 'index', intersect: false },
    plugins: { ...commonOptions.plugins, title: { display: false } }
  };

  // 4. Pie Chart: Waste Type Distribution
  const pieData = {
    labels: wasteTypeDistribution.map(w => w._id),
    datasets: [{
      data: wasteTypeDistribution.map(w => w.amount),
      backgroundColor: ['#f59e0b', '#64748b', '#3b82f6'],
      hoverOffset: 4
    }]
  };

  // 5. Doughnut Chart: Task Status
  const taskStatusMap = {
    "PENDING": "#fcd34d",
    "ASSIGNED": "#60a5fa",
    "IN_PROGRESS": "#818cf8",
    "COMPLETED": "#34d399",
    "REJECTED": "#ef4444"
  };

  const doughnutData = {
    labels: taskStatusDistribution.map(t => t._id),
    datasets: [{
      data: taskStatusDistribution.map(t => t.count),
      backgroundColor: taskStatusDistribution.map(t => taskStatusMap[t._id] || '#cbd5e1'),
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const roundedPieOptions = {
    ...commonOptions,
    scales: { x: { display: false }, y: { display: false } },
    cutout: '65%',
  };
  
  const standardPieOptions = {
    ...commonOptions,
    scales: { x: { display: false }, y: { display: false } },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Driver Performance</h3>
            <p className="text-sm text-primary/65">Waste collected by each driver</p>
          </div>
          <div className="h-72 w-full">
            {organizationData.length > 0 ? (
               <Bar data={barData} options={commonOptions} />
            ) : (
               <p className="text-primary/60 flex items-center justify-center h-full">No driver data yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Waste Type Distribution</h3>
            <p className="text-sm text-primary/65">Volume breakdown by waste category</p>
          </div>
          <div className="h-64 w-full flex justify-center">
            {wasteTypeDistribution.length > 0 ? (
               <Pie data={pieData} options={standardPieOptions} />
            ) : (
               <p className="text-primary/60 flex items-center h-full">No waste data yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Task Ecosystem Status</h3>
            <p className="text-sm text-primary/65">Completion health across tasks</p>
          </div>
          <div className="h-64 w-full flex justify-center">
            {taskStatusDistribution.length > 0 ? (
               <Doughnut data={doughnutData} options={roundedPieOptions} />
            ) : (
               <p className="text-primary/60 flex items-center h-full">No tasks yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-primary">Collection Trends</h3>
            <p className="text-sm text-primary/65">Daily waste collection (Last 7 Days)</p>
          </div>
        </div>
        <div className="h-80 w-full relative">
          {timeSeriesDataRaw.length > 0 ? (
             <Line data={timeSeriesData} options={lineOptions} />
          ) : (
             <p className="text-primary/60 flex items-center justify-center h-full">No collection data in the last 7 days</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsCharts;
