import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { manifestoConfig } from '../config';

gsap.registerPlugin(ScrollTrigger);

export default function Manifesto() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !textRef.current || !mediaRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        mediaRef.current,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            end: 'top 30%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      gsap.fromTo(
        textRef.current,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            end: 'top 30%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  if (!manifestoConfig.text && !manifestoConfig.videoPath && !manifestoConfig.fallbackImagePath) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      id="manifesto"
      style={{
        background: '#ffffff',
        color: '#000000',
        padding: '160px 40px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1360px',
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 46%) minmax(320px, 1fr)',
          gap: '64px',
          alignItems: 'center',
        }}
      >
        {manifestoConfig.videoPath ? (
          <div
            ref={mediaRef}
            style={{
              opacity: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                overflow: 'hidden',
                background: '#050a0f',
              }}
            >
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'grayscale(100%) contrast(1.1)',
                }}
              >
                <source src={manifestoConfig.videoPath} type="video/mp4" />
              </video>
            </div>
          </div>
        ) : manifestoConfig.fallbackImagePath ? (
          <div
            ref={mediaRef}
            style={{
              opacity: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                overflow: 'hidden',
                background: '#050a0f',
              }}
            >
              <img
                src={manifestoConfig.fallbackImagePath}
                alt="zkProof proof generation preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'grayscale(100%) contrast(1.08)',
                }}
              />
            </div>
          </div>
        ) : (
          <div ref={mediaRef} />
        )}

        <p
          ref={textRef}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '15px',
            fontWeight: 400,
            lineHeight: '25px',
            maxWidth: '680px',
            textAlign: 'left',
            margin: 0,
            opacity: 0,
          }}
        >
          {manifestoConfig.text}
        </p>
      </div>
    </section>
  );
}
