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
} from 'chart.js';
import { Bar, Line, Scatter, Pie, Doughnut } from 'react-chartjs-2';

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
  Legend
);

const AnalyticsCharts = ({ analyticsData }) => {
  // Destructure from real backend data, providing empty fallbacks
  const {
    organizationData = [],
    timeSeriesDataRaw = [],
    wasteTypeDistribution = [],
    taskStatusDistribution = []
  } = analyticsData || {};

  // 1. Process Time Series Data (transform from raw to ChartJS format)
  const timeSeriesData = useMemo(() => {
    // Collect all unique dates and orgs
    const datesSet = new Set();
    const orgsSet = new Set();
    const dataMap = {}; // { orgName: { date: dailyWaste } }

    timeSeriesDataRaw.forEach(item => {
      datesSet.add(item.date);
      orgsSet.add(item.orgName);
      if (!dataMap[item.orgName]) dataMap[item.orgName] = {};
      dataMap[item.orgName][item.date] = item.dailyWaste;
    });

    const labels = Array.from(datesSet).sort();
    
    // Some nice colors for the lines
    const colors = ['#4ade80', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899'];
    
    const datasets = Array.from(orgsSet).map((orgName, index) => {
      const data = labels.map(date => dataMap[orgName][date] || 0); // fill missing with 0
      const color = colors[index % colors.length];
      
      return {
        label: orgName,
        data,
        borderColor: color,
        backgroundColor: color + '80', // opacity
        tension: 0.4,
      };
    });

    return { labels, datasets };
  }, [timeSeriesDataRaw]);

  // Common options for stunning looks
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#2d3748', // var(--primary) approx
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: '500'
          },
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(25, 42, 28, 0.9)', // Dark green primary
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

  // 1. Bar Chart: Total Waste by Org
  const barData = {
    labels: organizationData.map(d => d.name),
    datasets: [
      {
        label: 'Total Waste Collected (kg)',
        data: organizationData.map(d => d.wasteCollectedField),
        backgroundColor: [
          'rgba(74, 222, 128, 0.8)', // accent
          'rgba(59, 130, 246, 0.8)', // blue
          'rgba(245, 158, 11, 0.8)', // amber
          'rgba(168, 85, 247, 0.8)', // purple
          'rgba(236, 72, 153, 0.8)', // pink
        ],
        borderRadius: 8,
      }
    ]
  };

  // 2. Line Chart: Trend over week
  const lineOptions = {
    ...commonOptions,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      ...commonOptions.plugins,
      title: {
        display: false,
      }
    }
  };

  // 3. Scatter Plot: Vehicles vs Waste
  const scatterData = {
    datasets: [
      {
        label: 'Organizations (Vehicles vs Waste)',
        data: organizationData.map(d => ({
          x: d.activeVehicles,
          y: d.wasteCollectedField,
          orgName: d.name
        })),
        backgroundColor: '#192a1c', // primary
        pointRadius: 8,
        pointHoverRadius: 10,
      }
    ]
  };

  const scatterOptions = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      tooltip: {
        ...commonOptions.plugins.tooltip,
        callbacks: {
          label: (context) => {
            const point = context.raw;
            return `${point.orgName}: ${point.x} Vehicles, ${point.y.toLocaleString()} kg`;
          }
        }
      }
    },
    scales: {
      x: {
        ...commonOptions.scales.x,
        title: {
          display: true,
          text: 'Active Vehicles',
          font: { family: "'Inter', sans-serif", weight: 'semibold' }
        }
      },
      y: {
        ...commonOptions.scales.y,
        title: {
          display: true,
          text: 'Total Waste (kg)',
          font: { family: "'Inter', sans-serif", weight: 'semibold' }
        }
      }
    }
  };

  // 4. Pie Chart: Waste Type Distribution
  const pieData = {
    labels: wasteTypeDistribution.map(w => w._id),
    datasets: [{
      data: wasteTypeDistribution.map(w => w.amount),
      backgroundColor: [
        '#f59e0b', // Amber for BIO (typically organic)
        '#64748b', // Slate for NON_BIO 
        '#3b82f6'  // Backup color
      ],
      hoverOffset: 4
    }]
  };

  // 5. Doughnut Chart: Task Status
  const taskStatusMap = {
    "PENDING": "#fcd34d", // Yellow
    "ASSIGNED": "#60a5fa", // Blue
    "IN_PROGRESS": "#818cf8", // Indigo
    "COMPLETED": "#34d399", // Green
    "REJECTED": "#ef4444" // Red
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

  // Pie/Doughnut specific options to make them look good inside the container
  const roundedPieOptions = {
    ...commonOptions,
    scales: { x: { display: false }, y: { display: false } }, // remove grids for pie
    cutout: '65%', // for doughnut
  };
  
  const standardPieOptions = {
    ...commonOptions,
    scales: { x: { display: false }, y: { display: false } },
  };


  return (
    <div className="space-y-6">
      {/* Top Row: Bar and Scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Bar Chart */}
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Organization Performance</h3>
            <p className="text-sm text-primary/65">Which organization is collecting the most waste</p>
          </div>
          <div className="h-72 w-full">
            <Bar data={barData} options={commonOptions} />
          </div>
        </div>

        {/* Scatter Plot: Efficiency */}
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Fleet Efficiency</h3>
            <p className="text-sm text-primary/65">Correlation between vehicles and waste collected</p>
          </div>
          <div className="h-72 w-full">
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
        </div>
      </div>

      {/* Middle Row: Pie and Doughnut Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Waste Distribution (Pie) */}
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Waste Type Distribution</h3>
            <p className="text-sm text-primary/65">Volume breakdown by waste category (Total kg)</p>
          </div>
          <div className="h-64 w-full flex justify-center">
            {wasteTypeDistribution.length > 0 ? (
               <Pie data={pieData} options={standardPieOptions} />
            ) : (
               <p className="text-primary/60 flex items-center h-full">No waste data yet</p>
            )}
          </div>
        </div>

        {/* Task Status (Doughnut) */}
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Task Ecosystem Status</h3>
            <p className="text-sm text-primary/65">Overall completion health across all organizations</p>
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

      {/* Bottom Row: Line Chart Trend */}
      <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-primary">Collection Trends</h3>
            <p className="text-sm text-primary/65">Daily waste collection across top organizations (This Week)</p>
          </div>
        </div>
        <div className="h-80 w-full relative">
          <Line data={timeSeriesData} options={lineOptions} />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
