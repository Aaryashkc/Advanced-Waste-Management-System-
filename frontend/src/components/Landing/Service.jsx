import { ArrowRight } from 'lucide-react';

export function Services() {
    const ImageOfRec= 'https://images.unsplash.com/photo-1717667745836-145a38948ebf?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

    const imgModelImage = 'https://images.unsplash.com/photo-1717667745836-145a38948ebf?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
  const services = [
    {
      title: 'Commercial Service',
      description: 'Recycling and waste programs evolve with the needs of organizations. Embedded into our operations is our 4-step continuous improvement process',
      image: imgModelImage,
    },
    {
      title: 'Routine Service',
      description: 'Recycling and waste programs evolve with the needs of organizations. Embedded into our operations is our 4-step continuous improvement process',
      image: ImageOfRec,
    },
    {
      title: 'Rental Service',
      description: 'Recycling and waste programs evolve with the needs of organizations. Embedded into our operations is our 4-step continuous improvement process',
      image: ImageOfRec,
    },
  ];

  return (
    <section className="bg-white w-full py-16 md:py-24 px-8 md:px-16 lg:px-24">
      <div className="max-w-[1440px] mx-auto">
        <h2 className="font-['Outfit'] font-bold text-[#354f52] text-4xl md:text-5xl mb-12">
          Industries We Serve
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div key={index} className="group">
              <div className="bg-white rounded-[20px] shadow-[3px_2px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden mb-6 h-[300px]">
                <img 
                  src={service.image} 
                  alt={service.title} 
                  className="w-full h-full object-cover blur-[2px] group-hover:blur-0 transition-all duration-300"
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-[#354f52] font-['Outfit'] font-medium text-2xl md:text-3xl">
                  {service.title}
                </h3>
                <p className="text-[#354f52] font-['Outfit'] text-sm leading-relaxed">
                  {service.description}
                </p>
                <button className="bg-[#354f52] text-[#f5f1e8] px-10 py-5 rounded-[20px] font-['Inter'] font-medium text-xl flex items-center gap-3 hover:bg-opacity-90 transition-all">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
