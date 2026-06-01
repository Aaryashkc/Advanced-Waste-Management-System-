import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// 1. Setup local components so everything is perfectly self-contained.
// Instead of defining them as completely separate React components that need ref forwarding,
// we just render them within the main page to easily animate them with GSAP context.

export default function TestAnimationPage() {
  const container = useRef(null);
  
  // TrashBin Ref
  const trashBinRef = useRef(null);
  
  // Section Refs
  const heroRef = useRef(null);
  const heroTextRef = useRef(null);
  
  const feature1Ref = useRef(null);
  const feature1TextRef = useRef(null);
  
  const feature2Ref = useRef(null);
  const feature2TextRef = useRef(null);
  
  const finalRef = useRef(null);
  const finalContentRef = useRef(null);

  useLayoutEffect(() => {
    // GSAP Context ensures everything is cleaned up when unmounted.
    let ctx = gsap.context(() => {
      // Set initial position of the TrashBin to be dead center.
      // We use xPercent/yPercent instead of strict transforms to allow clean animation.
      gsap.set(trashBinRef.current, { xPercent: -50, yPercent: -50 });

      // Calculate relative movements depending on device width
      const moveLeft = -window.innerWidth * 0.25;
      const moveRight = window.innerWidth * 0.25;

      // Master Timeline for TruthBin tied to the entire page scroll
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.5, // 1.5s delay on scrub for smoother, floating movement
        }
      });

      // --- PHASE 1: Hero to Feature 1 ---
      // TrashBin moves left, scales up, rotates slightly
      tl.to(trashBinRef.current, {
        x: moveLeft,
        scale: 1.5,
        rotation: -20,
        ease: "power2.inOut",
      }, 0);

      // Hero UI Avoidance: As scroll starts, move up and fade out to clear the stage
      tl.to(heroTextRef.current, {
        y: -200,
        opacity: 0,
        scale: 0.9,
        ease: "power1.in",
      }, 0);

      // Feature 1 UI Avoidance: Start hidden/shifted left, then animate right to make room 
      // for the TrashBin arriving on the left.
      tl.fromTo(feature1TextRef.current, 
        { x: -300, opacity: 0 },
        { x: window.innerWidth * 0.1, opacity: 1, ease: "power2.out" },
        0.2 // Starts slightly after scroll begins
      );

      // --- PHASE 2: Feature 1 to Feature 2 ---
      // TrashBin travels all the way to the right side, scaling back down a bit and rotating opposite
      tl.to(trashBinRef.current, {
        x: moveRight,
        scale: 1.2,
        rotation: 20,
        ease: "power2.inOut",
      }, 1);

      // Feature 1 UI fades out and shifts further right as we leave the section
      tl.to(feature1TextRef.current, {
        x: window.innerWidth * 0.4,
        opacity: 0,
        ease: "power1.in",
      }, 1);

      // Feature 2 UI Avoidance: Start shifted right, then move left to make room 
      // for the TrashBin arriving on the right.
      tl.fromTo(feature2TextRef.current,
        { x: 300, opacity: 0 },
        { x: -window.innerWidth * 0.1, opacity: 1, ease: "power2.out" },
        1.2
      );

      // --- PHASE 3: Feature 2 to Final Section ---
      // TrashBin returns to the center, scales up, and does a fun flip
      tl.to(trashBinRef.current, {
        x: 0,
        scale: 2,
        rotation: 360, 
        ease: "power3.inOut",
      }, 2);

      // Feature 2 UI leaves screen
      tl.to(feature2TextRef.current, {
        x: -window.innerWidth * 0.4,
        opacity: 0,
        ease: "power1.in",
      }, 2);

      // Final UI Avoidance: Reveals grandly around the correctly centered bin
      tl.fromTo(finalContentRef.current,
        { y: 150, opacity: 0, scale: 0.8 },
        { y: 0, opacity: 1, scale: 1, ease: "back.out(1.5)" },
        2.5 // Appears toward the very end of the scrub
      );

    }, container); // Scope animations strictly to the container

    return () => ctx.revert();
  }, []);

  return (
    <div ref={container} className="relative bg-slate-900 overflow-x-hidden text-white font-sans min-h-screen">
      
      {/* 
        The Central Character: TrashBin
        Fixed to the viewport, moves around based on GSAP scroll progress
      */}
      <div 
        ref={trashBinRef}
        className="fixed top-1/2 left-1/2 w-32 h-44 bg-green-500 rounded-xl shadow-2xl z-50 flex flex-col items-center justify-center border-4 border-green-400"
        style={{ willChange: 'transform' }}
      >
        <div className="w-full h-10 bg-green-600 rounded-t-lg border-b-4 border-green-700 mb-2"></div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-3xl font-black tracking-widest text-green-900 rotate-90">TRASH</span>
        </div>
      </div>

      {/* Hero Section */}
      <section ref={heroRef} className="h-screen w-full flex flex-col items-center justify-center relative z-10 p-8 border-b border-slate-800/50">
        <div ref={heroTextRef} className="text-center max-w-3xl bg-slate-800/50 p-12 rounded-[3rem] backdrop-blur-sm border border-slate-700/50 shadow-2xl">
          <h1 className="text-7xl font-black mb-6 bg-linear-to-r from-green-400 via-emerald-500 to-blue-500 text-transparent bg-clip-text leading-tight">
            The Interactive<br/>Waste Journey
          </h1>
          <p className="text-2xl text-slate-300 font-light">
            Keep scrolling to guide the character down.
          </p>
        </div>
      </section>

      {/* Feature Section 1 */}
      <section ref={feature1Ref} className="h-[150vh] w-full flex items-center relative z-10">
        <div ref={feature1TextRef} className="w-1/2 p-16 ml-auto mr-12 bg-slate-800/80 rounded-[3rem] backdrop-blur-md border border-slate-600 shadow-2xl">
          <h2 className="text-6xl font-black mb-8 text-green-400 tracking-tight">Dynamic Avoidance</h2>
          <p className="text-2xl leading-normal text-slate-300 font-light">
            As the TrashBin character moves to the left side of the screen, this section intelligently shifts right to maintain visual balance and stay out of its path.
          </p>
        </div>
      </section>

      {/* Feature Section 2 */}
      <section ref={feature2Ref} className="h-[150vh] w-full flex items-center relative z-10">
        <div ref={feature2TextRef} className="w-1/2 p-16 ml-12 bg-slate-800/80 rounded-[3rem] backdrop-blur-md border border-slate-600 shadow-2xl text-right">
          <h2 className="text-6xl font-black mb-8 text-blue-400 tracking-tight">Cinematic Travel</h2>
          <p className="text-2xl leading-normal text-slate-300 font-light">
            Now the character travels rapidly to the right side of the screen. Our section UI reacts defensively, fleeing to the left side to continue the game-like interaction.
          </p>
        </div>
      </section>

      {/* Final Section */}
      <section ref={finalRef} className="h-[120vh] w-full flex flex-col items-center justify-center relative z-10">
        <div ref={finalContentRef} className="text-center mt-96 border border-green-500/30 bg-green-900/20 p-16 rounded-[4rem] backdrop-blur-xl shadow-2xl">
          <h2 className="text-7xl font-black mb-6 text-white tracking-tight">Mission Accomplished</h2>
          <p className="text-3xl text-green-200/80 mb-12 font-light">The character has centered successfully.</p>
          <button className="px-12 py-6 bg-green-500 hover:bg-green-400 text-slate-900 rounded-full font-black text-2xl transition-all hover:scale-105 hover:shadow-2xl cursor-pointer">
            Play Again
          </button>
        </div>
      </section>

    </div>
  );
}
