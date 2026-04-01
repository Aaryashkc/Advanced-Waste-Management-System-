import { ArrowRight } from 'lucide-react';

export function Features() {
  const features = [
    {
      label: 'Routes',
      title: 'Routine waste collection',
      description: 'Automated route assignment and daily schedules for your fleet.',
    },
    {
      label: 'Requests',
      title: 'On-demand pickups',
      description: 'Request trucks by waste type and volume instantly.',
    },
    {
      label: 'Manage',
      title: 'Organizations panel',
      description: 'Control drivers, trucks, and route assignments from one place.',
    },
    {
      label: 'Tasks',
      title: 'Driver tasks',
      description: 'Assigned pickups with real-time status updates.',
    },
    {
      label: 'Submissions',
      title: 'User requests',
      description: 'Track all waste pickup requests from citizens.',
    },
    {
      label: 'Analytics',
      title: 'Performance insights',
      description: 'Monitor collection efficiency and optimize operations.',
    },
  ];

  return (
    <section className="bg-white w-full py-20 md:py-28 px-6 md:px-16 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="font-['Outfit'] font-bold text-primary text-3xl md:text-4xl mb-4">
            Six tools built for waste
          </h2>
          <p className="text-primary/60 text-lg font-['Outfit']">
            Everything you need to run operations efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-accent/50 rounded-2xl p-8 flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <span className="text-primary/50 font-['Outfit'] text-sm font-medium tracking-wide uppercase">
                  {feature.label}
                </span>
                <h3 className="text-primary font-['Outfit'] font-semibold text-xl mt-3 mb-3">
                  {feature.title}
                </h3>
                <p className="text-primary/60 font-['Outfit'] text-base leading-relaxed">
                  {feature.description}
                </p>
              </div>
              <div className="mt-6">
                <button className="text-primary font-['Outfit'] text-sm font-medium flex items-center gap-2 hover:gap-3 transition-all">
                  Learn more
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
