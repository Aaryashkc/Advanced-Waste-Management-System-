import { Facebook, Instagram, Linkedin, Youtube, X } from "lucide-react";

function SocialIcon({ Icon, label }) {
  if (!Icon) return null;

  return (
    <button
      aria-label={label}
      className="w-6 h-6 hover:opacity-70 transition-opacity text-[#f5f1e8]"
      type="button"
    >
      <Icon className="w-full h-full" />
    </button>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#354f52] w-full py-16 md:py-20">
      <div className="mx-auto max-w-360 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 mb-14 md:mb-16">
          <div className="text-left">
            <h3 className="text-[#f5f1e8] font-semibold text-base mb-4">Product</h3>
            <ul className="space-y-2">
              {["Dashboard", "Features", "Pricing", "Updates", "Company"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-[#f5f1e8] text-sm hover:opacity-70 transition-opacity">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-left">
            <h3 className="text-[#f5f1e8] font-semibold text-base mb-4">Support</h3>
            <ul className="space-y-2">
              {["Contact", "Help", "Careers", "Resources", "Blog"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-[#f5f1e8] text-sm hover:opacity-70 transition-opacity">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-left">
            <h3 className="text-[#f5f1e8] font-semibold text-base mb-4">Guides</h3>
            <ul className="space-y-2">
              {["API", "Docs", "Status", "Community", "Legal"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-[#f5f1e8] text-sm hover:opacity-70 transition-opacity">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-left">
            <h3 className="text-[#f5f1e8] font-semibold text-base mb-4">Updates</h3>
            <p className="text-[#f5f1e8] text-base mb-6 max-w-md">
              Get the latest news and feature releases delivered straight to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3">
              <input
                type="email"
                placeholder="Enter email"
                className="w-full sm:flex-1 bg-transparent border border-[#f5f1e8] px-4 py-3 text-[#f5f1e8] placeholder:text-[rgba(218,255,191,0.6)] focus:outline-none focus:ring-2 focus:ring-[#f5f1e8]"
              />
              <button
                className="border border-[#f5f1e8] text-[#f5f1e8] px-6 py-3 sm:py-3.5 hover:bg-[#f5f1e8] hover:text-[#354f52] transition-all"
                type="button"
              >
                Join
              </button>
            </div>
            <p className="text-[#f5f1e8] text-xs">
              We respect your privacy and only send updates you care about.
            </p>
          </div>
        </div>

        <div className="border-t border-[#f5f1e8]/70 mb-8" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[#f5f1e8] text-sm">
            <p>© {new Date().getFullYear()} Safabin Dashboard. All rights reserved.</p>
            <a href="#" className="underline hover:opacity-70 transition-opacity">Privacy Policy</a>
            <a href="#" className="underline hover:opacity-70 transition-opacity">Terms of Service</a>
            <a href="#" className="underline hover:opacity-70 transition-opacity">Cookie Settings</a>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <SocialIcon Icon={Facebook} label="Facebook" />
            <SocialIcon Icon={Instagram} label="Instagram" />
            <SocialIcon Icon={X} label="X" />
            <SocialIcon Icon={Linkedin} label="LinkedIn" />
            <SocialIcon Icon={Youtube} label="YouTube" />
          </div>
        </div>
      </div>
    </footer>
  );
}
