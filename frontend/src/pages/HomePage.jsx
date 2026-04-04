import React, { useEffect, useRef } from 'react'
import { Hero } from '../components/Landing/Hero'
import { AboutSection } from '../components/Landing/AboutUs'
import { Features } from '../components/Landing/Features'
import { Services } from '../components/Landing/Service'
import { FAQ } from '../components/Landing/FAQ'
import { CTASection } from '../components/Landing/CTASection'


const HomePage = () => {
  const pageRef = useRef(null)
  const sections = [
    { Component: Hero, isHero: true },
    { Component: AboutSection },
    { Component: Features },
    { Component: Services },
    { Component: FAQ },
    { Component: CTASection },
  ]

  useEffect(() => {
    const container = pageRef.current
    if (!container) return

    const revealItems = Array.from(container.querySelectorAll('.lp-reveal'))
    if (!revealItems.length) return

    const revealAll = () => {
      revealItems.forEach((item) => item.classList.add('lp-in-view'))
    }

    if (
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      revealAll()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-in-view')
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    revealItems.forEach((item) => observer.observe(item))

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={pageRef} className="landing-page-shell">
      {sections.map(({ Component, isHero }, index) => (
        <div key={Component.name || index} className={isHero ? "" : "lp-reveal"}>
          <Component />
        </div>
      ))}
    </div>
  )
}

export default HomePage
