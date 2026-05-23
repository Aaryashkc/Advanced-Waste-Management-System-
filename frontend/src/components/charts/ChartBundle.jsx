import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  Title,
} from "chart.js";
import { Bar, Bubble, Doughnut, Line, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  Title,
);

const CHARTS = {
  bar: Bar,
  bubble: Bubble,
  doughnut: Doughnut,
  line: Line,
  pie: Pie,
};

export default function ChartBundle({ type, ...props }) {
  const Chart = CHARTS[type];
  return Chart ? <Chart {...props} /> : null;
}
