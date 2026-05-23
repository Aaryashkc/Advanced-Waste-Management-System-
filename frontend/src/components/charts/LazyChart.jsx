import { Suspense, lazy } from "react";

const ChartBundle = lazy(() => import("./ChartBundle"));

const ChartFallback = () => (
  <div className="flex h-full min-h-32 items-center justify-center text-sm font-medium text-primary/45">
    Loading chart...
  </div>
);

export default function LazyChart(props) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <ChartBundle {...props} />
    </Suspense>
  );
}
