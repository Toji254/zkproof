import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function useAnimations() {
  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      console.log('Prefers reduced motion is active. Skipping GSAP animations.');
      return;
    }

    // 1. Hero contents entry animation (staggered fade-in + slide-up)
    gsap.from('.hero-content h1, .hero-content p, .hero-content .hero-buttons', {
      opacity: 0,
      y: 40,
      stagger: 0.15,
      duration: 1,
      ease: 'power3.out',
    });

    // 2. Step cards slide-up on scroll
    const stepsGrid = document.querySelector('.steps-grid');
    if (stepsGrid) {
      gsap.from('.step-card', {
        scrollTrigger: {
          trigger: stepsGrid,
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        y: 60,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power2.out',
      });
    }

    // 3. Stat numbers count-up animation on scroll
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
      const text = stat.textContent.trim();
      const targetVal = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
      const isPercentage = text.includes('%');
      const isPlus = text.includes('+');
      
      const counter = { val: 0 };
      
      gsap.to(counter, {
        val: targetVal,
        scrollTrigger: {
          trigger: stat,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        duration: 1.8,
        ease: 'power1.out',
        onUpdate: () => {
          let formatted = Math.floor(counter.val).toLocaleString();
          if (isPercentage) formatted += '%';
          if (isPlus) formatted += '+';
          stat.textContent = formatted;
        }
      });
    });

    // 4. Parallax mouse movement effect on hero section
    const hero = document.querySelector('.hero');
    if (hero) {
      const handleMouseMove = (e) => {
        const { clientX, clientY } = e;
        const xPos = (clientX / window.innerWidth - 0.5) * 30;
        const yPos = (clientY / window.innerHeight - 0.5) * 30;
        
        gsap.to(hero, {
          '--bg-x': `${50 + xPos}%`,
          '--bg-y': `${50 + yPos}%`,
          duration: 0.8,
          ease: 'power2.out',
        });
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);
}
