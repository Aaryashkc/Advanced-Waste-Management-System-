export function AboutSection() {
  return (
    <section className="bg-white w-full py-10 md:py-16 px-8 md:px-16 lg:px-24">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="font-['Outfit'] font-bold text-[#354f52] text-3xl md:text-4xl mb-6">
              Custom, tech-enabled environmental services{' '}
              <span className="bg-gradient-to-r from-[#57a521] to-[#296200] bg-clip-text" style={{ WebkitTextFillColor: 'transparent' }}>
                for your business and Home
              </span>
            </h2>
          </div>
          <div>
            <p className="text-black text-lg md:text-xl font-['Outfit'] leading-relaxed">
              Safabin is unique —our recycling and waste services should be, too. Through advanced data and technology, we analyze your waste streams to develop custom programs that bring real economic, environmental, and societal impact.
            </p>
          </div>
        </div>
        
        {/* Gradient divider */}
        <div className="mt-12">
          <div className="h-[7px] w-full bg-gradient-to-r from-[#57A521] to-[#296200] rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
