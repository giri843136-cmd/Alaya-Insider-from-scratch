'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Slide {
  id: string; eyebrow: string; headline: string; description: string;
  primary_cta_label: string; primary_cta_url: string;
  secondary_cta_label: string; secondary_cta_url: string;
  desktop_image: string; tablet_image: string; mobile_image: string;
  background_color: string; text_alignment: string; text_color: string;
  layout: string;
}

interface Props {
  slides: Slide[];
  autoplay?: boolean;
  interval?: number;
  transition?: string;
  transitionDuration?: number;
}

export default function HeroCarousel({ slides, autoplay = true, interval = 5000, transitionDuration = 500 }: Props) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const timerRef = useRef<any>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const total = slides.length;

  const goTo = useCallback((index: number) => {
    if (isTransitioning || total === 0) return;
    setIsTransitioning(true);
    setCurrent(((index % total) + total) % total);
    setTimeout(() => setIsTransitioning(false), transitionDuration);
  }, [total, isTransitioning, transitionDuration]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Autoplay
  useEffect(() => {
    if (!autoplay || isPaused || total <= 1) return;
    timerRef.current = setInterval(next, interval);
    return () => clearInterval(timerRef.current);
  }, [autoplay, isPaused, interval, next, total]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!carouselRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prev, next]);

  // Early return AFTER all hooks
  if (total === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.changedTouches[0].screenX; setIsPaused(true); };
  const onTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
    setTimeout(() => setIsPaused(false), 3000);
  };

  const slide = slides[current];
  if (!slide) return null;
  const isDark = slide.text_color === 'light';

  return (
    <div
      ref={carouselRef}
      className="relative overflow-hidden select-none"
      role="region"
      aria-label="Promotional carousel"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative" style={{ height: 'clamp(240px, 30vw, 380px)' }}>
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="tabpanel"
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} of ${total}: ${s.headline}`}
            aria-hidden={i !== current}
            className={`absolute inset-0 transition-opacity ${i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            style={{ transitionDuration: `${transitionDuration}ms`, backgroundColor: s.background_color || '#f8f6f3' }}
          >
            {s.desktop_image && (
              <img src={s.desktop_image} alt={s.headline || 'Promotional image'}
                className="absolute inset-0 w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined} />
            )}
            {/* Content area — inset horizontally to create safe zone for arrows */}
            <div className="relative z-10 h-full flex items-center"
              style={{ padding: '0 clamp(60px, 7vw, 100px)' }}>
              <div className={`max-w-lg ${s.layout === 'text-right' ? 'ml-auto text-right' : s.layout === 'text-center' ? 'mx-auto text-center' : ''}`}>
                {s.eyebrow && (
                  <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] ${isDark ? 'text-white/60' : 'text-warm'}`}>{s.eyebrow}</span>
                )}
                {s.headline && (
                  <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight mt-2 ${isDark ? 'text-white' : 'text-accent'}`}>{s.headline}</h2>
                )}
                {s.description && (
                  <p className={`text-sm sm:text-base mt-3 leading-relaxed ${isDark ? 'text-white/70' : 'text-gray-500'} ${s.layout === 'text-right' ? 'ml-auto' : s.layout === 'text-center' ? 'mx-auto' : ''}`}
                    style={{ maxWidth: '520px' }}>
                    {s.description}
                  </p>
                )}
                <div className={`flex gap-3 mt-5 flex-wrap ${s.layout === 'text-right' ? 'justify-end' : s.layout === 'text-center' ? 'justify-center' : ''}`}>
                  {s.primary_cta_label && s.primary_cta_url && (
                    <Link href={s.primary_cta_url}
                      className={`inline-flex items-center justify-center px-6 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${isDark ? 'bg-white text-accent hover:bg-white/90' : 'bg-accent text-white hover:bg-accent-light'}`}
                      style={{ height: '48px', minWidth: '180px' }}>
                      {s.primary_cta_label}
                    </Link>
                  )}
                  {s.secondary_cta_label && s.secondary_cta_url && (
                    <Link href={s.secondary_cta_url}
                      className={`inline-flex items-center justify-center px-6 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${isDark ? 'border-white/30 text-white hover:bg-white/10' : 'border-gray-300 text-gray-600 hover:border-accent hover:text-accent'}`}
                      style={{ height: '48px', minWidth: '190px' }}>
                      {s.secondary_cta_label}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation arrows — positioned in safe zones outside content area */}
      {total > 1 && (
        <>
          <button onClick={prev} aria-label="Previous slide"
            className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-white/50 text-gray-600 hover:bg-white hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-all"
            style={{ left: 'clamp(12px, 2vw, 28px)', width: '44px', height: '44px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={next} aria-label="Next slide"
            className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-white/50 text-gray-600 hover:bg-white hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-all"
            style={{ right: 'clamp(12px, 2vw, 28px)', width: '44px', height: '44px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2" role="tablist" aria-label="Slide navigation">
          {slides.map((s, i) => (
            <button key={s.id} role="tab" aria-selected={i === current} aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${i === current ? 'w-6 h-2 bg-accent' : 'w-2 h-2 bg-gray-400/40 hover:bg-gray-400/70'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
