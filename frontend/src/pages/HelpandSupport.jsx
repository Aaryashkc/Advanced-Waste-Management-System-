import React, { useState, useMemo } from "react";
import {
  Search,
  Rocket,
  User,
  CreditCard,
  Settings,
  Shield,
  Code,
  HelpCircle,
  ChevronRight,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react";

const ICON_MAP = {
  Rocket: Rocket,
  User: User,
  CreditCard: CreditCard,
  Settings: Settings,
  Shield: Shield,
  Code: Code,
};

const helpTopics = [
  { id: 1, category: "Getting Started", title: "How to use SafaBin?", description: "Learn the basics of our waste management system and how to track waste pickups.", icon: "Rocket" },
  { id: 2, category: "Account", title: "Managing your Profile", description: "Update your personal details, change your password, and manage your preferences.", icon: "User" },
  { id: 3, category: "Billing", title: "Invoices and Payments", description: "Understand your billing cycle, view invoices, and update payment methods.", icon: "CreditCard" },
  { id: 4, category: "Settings", title: "Notification Preferences", description: "Configure how and when you receive updates about your garbage collection.", icon: "Settings" },
  { id: 5, category: "Security", title: "Data Privacy & Safety", description: "Learn how we protect your personal data and ensure your privacy.", icon: "Shield" },
  { id: 6, category: "Developers", title: "API Documentation", description: "Integrate your applications with SafaBin using our complete API guide.", icon: "Code" },
];

export default function HelpSupportPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTopics = useMemo(() => {
    return helpTopics.filter(
      (topic) =>
        topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-accent text-primary font-sans flex flex-col">
      {/* Hero Section */}
      <section className="bg-linear-to-br from-black/95 to-black/85 pt-32 pb-24 px-4 text-center rounded-b-[2rem] md:rounded-b-[4rem] relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative max-w-4xl mx-auto z-10">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Help & Support
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            Search our knowledge base or browse by category to find the answers you need.
          </p>

          <div className="relative max-w-2xl mx-auto group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/50 w-6 h-6 transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              placeholder="Search for anything..."
              className="w-full py-4 pl-14 pr-4 rounded-2xl shadow-lg border-2 border-transparent focus:border-primary/20 focus:ring-4 focus:ring-primary/10 text-lg bg-white text-primary placeholder:text-primary/40 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Topics Grid */}
      <main className="flex-grow max-w-6xl mx-auto py-16 px-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <h2 className="text-2xl md:text-3xl font-bold text-primary">
            {searchQuery
              ? `Search results for "${searchQuery}"`
              : "Popular Topics"}
          </h2>
          <span className="text-primary/70 font-bold px-4 py-1.5 bg-primary/5 rounded-full text-sm shrink-0">
            {filteredTopics.length} topics found
          </span>
        </div>

        {filteredTopics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTopics.map((topic) => {
              const IconComponent = ICON_MAP[topic.icon] || HelpCircle;
              return (
                <div
                  key={topic.id}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border border-primary/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer group hover:-translate-y-1 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-4 bg-accent/80 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      <IconComponent size={24} />
                    </div>
                    <span className="text-xs font-bold text-primary/70 uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full group-hover:bg-primary/10 transition-colors duration-300">
                      {topic.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-primary group-hover:text-primary/80 transition-colors">
                    {topic.title}
                  </h3>
                  <p className="text-primary/70 mb-8 line-clamp-3 leading-relaxed flex-grow">
                    {topic.description}
                  </p>
                  <div className="flex items-center text-primary font-bold text-sm tracking-wide mt-auto">
                    Read more{" "}
                    <ChevronRight
                      size={18}
                      className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-primary/20 shadow-sm">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
              <HelpCircle size={40} className="text-primary/40" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-primary">No results found</h3>
            <p className="text-primary/60 max-w-md mx-auto mb-8">
              We couldn't find anything matching "{searchQuery}". Try different keywords or browse our categories.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-brand-primary-hover active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
            >
              Clear search
            </button>
          </div>
        )}
      </main>

      {/* Contact Section */}
      <section className="bg-white py-24 px-4 relative mt-auto border-t border-primary/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-5">Still need help?</h2>
            <p className="text-primary/60 text-lg max-w-xl mx-auto">
              Our dedicated support team is here for you. Choose a convenient way to get in touch with us.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="flex flex-col items-center text-center p-10 bg-accent/30 rounded-[2rem] border border-primary/5 hover:bg-white hover:shadow-2xl hover:border-primary/10 transition-all duration-300 group">
              <div className="w-16 h-16 bg-white shadow-sm flex items-center justify-center text-primary rounded-2xl mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Mail size={28} />
              </div>
              <h4 className="text-xl font-bold text-primary mb-2">Email Us</h4>
              <p className="text-primary/60 mb-6 font-medium">
                Response within 24 hours
              </p>
              <a
                href="mailto:support@safabin.com"
                className="text-primary font-bold hover:underline decoration-2 underline-offset-4"
              >
                support@safabin.com
              </a>
            </div>

            <div className="flex flex-col items-center text-center p-10 bg-accent/30 rounded-[2rem] border border-primary/5 hover:bg-white hover:shadow-2xl hover:border-primary/10 transition-all duration-300 group">
              <div className="w-16 h-16 bg-white shadow-sm flex items-center justify-center text-primary rounded-2xl mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <MessageSquare size={28} />
              </div>
              <h4 className="text-xl font-bold text-primary mb-2">Live Chat</h4>
              <p className="text-primary/60 mb-6 font-medium">
                Available Sun-Fri, 9am - 6pm
              </p>
              <button className="text-primary font-bold hover:underline decoration-2 underline-offset-4">
                Start a chat
              </button>
            </div>

            <div className="flex flex-col items-center text-center p-10 bg-accent/30 rounded-[2rem] border border-primary/5 hover:bg-white hover:shadow-2xl hover:border-primary/10 transition-all duration-300 group">
              <div className="w-16 h-16 bg-white shadow-sm flex items-center justify-center text-primary rounded-2xl mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Phone size={28} />
              </div>
              <h4 className="text-xl font-bold text-primary mb-2">Phone Support</h4>
              <p className="text-primary/60 mb-6 font-medium">
                Standard rates may apply
              </p>
              <a
                href="tel:+977011234567"
                className="text-primary font-bold hover:underline decoration-2 underline-offset-4"
              >
                +977 01-1234567
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
