'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import styles from './HeroCarousel.module.css';

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

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
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

  // Keyboard navigation
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

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
    setIsPaused(true);
  };
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
      className={styles.carousel}
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
      {/* Slide layers */}
      <div className={styles.viewport}>
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="tabpanel"
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} of ${total}: ${s.headline}`}
            aria-hidden={i !== current}
            className={cx(styles.slide, i === current && styles.slideActive)}
            style={{
              transitionDuration: `${transitionDuration}ms`,
              backgroundColor: s.background_color || '#f8f6f3',
            }}
          >
            {s.desktop_image && (
              <img
                src={s.desktop_image}
                alt={s.headline || 'Promotional image'}
                className={styles.slideImage}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
              />
            )}
          </div>
        ))}

        {/* Content overlay — lives above all slides, inside viewport */}
        <div className={styles.contentLayer}>
          <div className={cx(
            styles.content,
            slide.layout === 'text-right' && styles.contentRight,
            slide.layout === 'text-center' && styles.contentCenter
          )}>
            {slide.eyebrow && (
              <span className={cx(styles.eyebrow, isDark && styles.eyebrowLight)}>
                {slide.eyebrow}
              </span>
            )}
            {slide.headline && (
              <h2 className={cx(styles.headline, isDark && styles.headlineLight)}>
                {slide.headline}
              </h2>
            )}
            {slide.description && (
              <p className={cx(styles.description, isDark && styles.descriptionLight)}>
                {slide.description}
              </p>
            )}
            <div className={cx(
              styles.ctaGroup,
              slide.layout === 'text-right' && styles.ctaGroupRight,
              slide.layout === 'text-center' && styles.ctaGroupCenter
            )}>
              {slide.primary_cta_label && slide.primary_cta_url && (
                <Link
                  href={slide.primary_cta_url}
                  className={cx(
                    styles.cta,
                    styles.ctaPrimary,
                    isDark && styles.ctaPrimaryLight
                  )}
                >
                  {slide.primary_cta_label}
                </Link>
              )}
              {slide.secondary_cta_label && slide.secondary_cta_url && (
                <Link
                  href={slide.secondary_cta_url}
                  className={cx(
                    styles.cta,
                    styles.ctaSecondary,
                    isDark && styles.ctaSecondaryLight
                  )}
                >
                  {slide.secondary_cta_label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation arrows — positioned on the carousel container, outside content flow */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous slide"
            className={cx(styles.arrow, styles.arrowPrev)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className={cx(styles.arrow, styles.arrowNext)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className={styles.dots} role="tablist" aria-label="Slide navigation">
          {slides.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === current}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cx(styles.dot, i === current && styles.dotActive)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
