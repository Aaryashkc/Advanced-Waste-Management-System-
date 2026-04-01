import { ArrowRight } from 'lucide-react';

export function Services() {
  const services = [
    {
      title: 'Commercial Service',
      description: 'Tailored recycling and waste programs that evolve with your organization through our continuous improvement process.',
      image: 'https://images.unsplash.com/photo-1717667745836-145a38948ebf?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    {
      title: 'Routine Service',
      description: 'Scheduled collection and disposal programs designed around your operational cadence and waste volume.',
      image: 'https://images.unsplash.com/photo-1717667745836-145a38948ebf?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    {
      title: 'Rental Service',
      description: 'Flexible container and equipment rental for short-term projects, events, or overflow management.',
      image: 'https://images.unsplash.com/photo-1717667745836-145a38948ebf?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
  ];

  return (
    <section className="w-full py-20 md:py-28 px-6 md:px-16 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="font-['Outfit'] font-bold text-primary text-3xl md:text-4xl mb-4">
            Industries We Serve
          </h2>
          <p className="text-primary/60 text-lg font-['Outfit']">
            Solutions designed for every scale of waste management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div key={index} className="group">
              <div className="rounded-2xl overflow-hidden mb-6 aspect-[4/3]">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-primary font-['Outfit'] font-semibold text-xl mb-3">
                {service.title}
              </h3>
              <p className="text-primary/60 font-['Outfit'] text-base leading-relaxed mb-5">
                {service.description}
              </p>
              <button className="text-primary font-['Outfit'] text-sm font-medium flex items-center gap-2 hover:gap-3 transition-all">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
