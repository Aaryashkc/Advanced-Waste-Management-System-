import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Chrome,
  Download,
  ExternalLink,
  Home,
  MoreVertical,
  Share,
  ShieldCheck,
  Smartphone,
  Wifi,
} from "lucide-react";
import {
  clearPwaInstallPrompt,
  getPwaInstallPrompt,
  subscribeToPwaInstallPrompt,
} from "../utils/pwaInstall";

const HERO_IMAGE =
  "https://unsplash.com/photos/iR4mClggzEU/download?force=true&w=1920";

const isStandaloneDisplay = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

export default function DownloadApp() {
  const [installPrompt, setInstallPrompt] = useState(() => getPwaInstallPrompt());
  const [installState, setInstallState] = useState(() => (getPwaInstallPrompt() ? "ready" : "idle"));
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplay());

  const device = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
    return "desktop";
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPwaInstallPrompt((prompt) => {
      setInstallPrompt(prompt);
      if (prompt && installState === "idle") {
        setInstallState("ready");
      }
    });

    const handleInstalled = () => {
      setInstallState("installed");
      setIsInstalled(true);
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [installState]);

  const handleInstall = async () => {
    if (isInstalled) {
      setInstallState("installed");
      return;
    }

    if (!installPrompt) {
      setInstallState("manual");
      return;
    }

    setInstallState("prompting");
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    clearPwaInstallPrompt();
    setInstallState(choice.outcome === "accepted" ? "installing" : "manual");
  };

  const statusMessage = {
    idle: "Tap the button below. If your browser supports direct install, the phone install prompt will open.",
    ready: "Your browser is ready for one-tap install.",
    prompting: "Confirm the install prompt shown by your browser.",
    installing: "Install started. Check your home screen once the browser finishes.",
    installed: "GreenShift is already installed on this device.",
    manual: "Your browser did not open an install prompt. Follow the steps for your phone below.",
  }[installState];

  const steps = [
    {
      id: "android",
      title: "Android Chrome",
      active: device === "android",
      icon: Chrome,
      items: [
        { icon: Chrome, title: "Open in Chrome", text: "Use Chrome on your Android phone and sign in to GreenShift." },
        { icon: MoreVertical, title: "Open the menu", text: "Tap the three-dot menu in the top-right corner." },
        { icon: Download, title: "Choose Install app", text: "Tap Install app. If you see Add to Home screen, tap that instead." },
        { icon: Home, title: "Confirm", text: "Tap Install. GreenShift will appear with your other phone apps." },
      ],
    },
    {
      id: "ios",
      title: "iPhone Safari",
      active: device === "ios",
      icon: Share,
      items: [
        { icon: ExternalLink, title: "Open in Safari", text: "Use Safari, not Chrome, because iPhone installs web apps through Safari." },
        { icon: Share, title: "Tap Share", text: "Tap the share button at the bottom of the Safari screen." },
        { icon: Home, title: "Add to Home Screen", text: "Scroll the share sheet and tap Add to Home Screen." },
        { icon: CheckCircle2, title: "Tap Add", text: "Keep the name GreenShift, tap Add, then launch it from your home screen." },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-brand-surface-soft text-primary">
      <section
        className="relative min-h-screen overflow-hidden bg-black bg-cover bg-center bg-no-repeat pt-24"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      >
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/95 via-black/90 to-black/85" />
        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl gap-8 px-6 pb-12 pt-6 md:grid-cols-[1fr_0.9fr] md:px-16 lg:px-24">
          <div className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
            <Smartphone size={15} />
            Phone app install
          </div>

          <h1 className="max-w-2xl text-4xl font-black leading-tight text-white md:text-6xl">
            Install GreenShift on your phone
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/80">
            Get the same GreenShift website as an app on your home screen. It opens faster, feels cleaner, and keeps pickup requests one tap away.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleInstall}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-primary shadow-lg shadow-black/20 transition hover:bg-accent"
            >
              <Download size={18} />
              Install GreenShift
            </button>
            <a
              href="#install-steps"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              View phone steps
            </a>
          </div>

          <div className="mt-5 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80 shadow-sm backdrop-blur-sm">
            {statusMessage}
          </div>

          <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-white shadow-sm backdrop-blur-sm">
              <Wifi size={20} className="mb-3 text-emerald-300" />
              <p className="text-sm font-bold">Quick access</p>
              <p className="mt-1 text-xs leading-5 text-white/60">Launch from the home screen.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-white shadow-sm backdrop-blur-sm">
              <ShieldCheck size={20} className="mb-3 text-blue-300" />
              <p className="text-sm font-bold">Secure</p>
              <p className="mt-1 text-xs leading-5 text-white/60">Uses your deployed HTTPS site.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-white shadow-sm backdrop-blur-sm">
              <CheckCircle2 size={20} className="mb-3 text-amber-300" />
              <p className="text-sm font-bold">No app store</p>
              <p className="mt-1 text-xs leading-5 text-white/60">Install directly from the browser.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <div className="relative h-[560px] w-[290px] rounded-[2.5rem] border-[10px] border-brand-ink-strong bg-brand-ink-strong shadow-2xl">
            <div className="absolute left-1/2 top-3 h-5 w-24 -translate-x-1/2 rounded-full bg-black/70" />
            <div className="h-full overflow-hidden rounded-[1.8rem] bg-accent">
              <div className="bg-primary px-5 pb-8 pt-12 text-white">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-black">GreenShift</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Smartphone size={18} />
                  </div>
                </div>
                <p className="mt-8 text-3xl font-black leading-tight">Pickup requests, now on your home screen.</p>
              </div>
              <div className="space-y-3 p-5">
                {["Schedule pickup", "Track status", "View billing"].map((label) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={18} />
                    </div>
                    <p className="text-sm font-bold text-primary">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section id="install-steps" className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-6 md:px-16 lg:px-24">
          <div className="mb-7 flex flex-col gap-2">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Manual install guide</p>
            <h2 className="text-3xl font-black text-primary">Choose your phone</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {steps.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div
                  key={group.id}
                  className={`rounded-2xl border p-5 shadow-sm ${group.active ? "border-primary bg-primary/5" : "border-primary/10 bg-white"}`}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
                        <GroupIcon size={21} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-primary">{group.title}</h3>
                        {group.active && <p className="text-xs font-semibold text-emerald-700">Recommended for this device</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((item, index) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={item.title} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-primary/10 bg-white p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
                            <ItemIcon size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-primary">
                              {index + 1}. {item.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-primary/60">{item.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
