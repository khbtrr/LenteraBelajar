'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useTour } from './tour-context';
import { Button } from '@/components/ui/button';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function AppTour() {
  const t = useTranslations('tour');
  const {
    isOpen,
    currentStepIndex,
    totalSteps,
    currentStep,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Measure and compute target position
  const updatePositions = useCallback(() => {
    if (!isOpen || !currentStep) {
      setTargetRect(null);
      setPopoverPos(null);
      return;
    }

    let el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el && currentStep.fallbackSelector) {
      el = document.querySelector(currentStep.fallbackSelector) as HTMLElement | null;
    }

    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 6;
      const computedRect: TargetRect = {
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        bottom: rect.bottom + padding,
        right: rect.right + padding,
      };
      setTargetRect(computedRect);

      // Scroll into view if out of viewport
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Calculate popover coordinates
      const popoverWidth = 360;
      const popoverHeight = 220; // approximate estimate
      const margin = 14;
      const isMobile = window.innerWidth < 640;

      let top = 0;
      let left = 0;

      if (isMobile) {
        // Mobile layout: centered near bottom
        top = Math.max(16, window.innerHeight - popoverHeight - 24);
        left = Math.max(16, (window.innerWidth - popoverWidth) / 2);
      } else {
        const preferredPlacement = currentStep.placement || 'bottom';

        if (preferredPlacement === 'right' && computedRect.right + popoverWidth + margin < window.innerWidth) {
          left = computedRect.right + margin;
          top = Math.max(16, Math.min(computedRect.top, window.innerHeight - popoverHeight - 16));
        } else if (preferredPlacement === 'bottom' && computedRect.bottom + popoverHeight + margin < window.innerHeight) {
          top = computedRect.bottom + margin;
          left = Math.max(16, Math.min(computedRect.left, window.innerWidth - popoverWidth - 16));
        } else if (computedRect.top - popoverHeight - margin > 0) {
          top = computedRect.top - popoverHeight - margin;
          left = Math.max(16, Math.min(computedRect.left, window.innerWidth - popoverWidth - 16));
        } else {
          // Default fall-through: placed below or clamped inside viewport
          top = Math.max(16, Math.min(computedRect.bottom + margin, window.innerHeight - popoverHeight - 16));
          left = Math.max(16, Math.min(computedRect.left, window.innerWidth - popoverWidth - 16));
        }
      }

      setPopoverPos({ top, left });
    } else {
      // Fallback if target element is currently not in DOM
      setTargetRect(null);
      setPopoverPos({
        top: Math.max(20, (window.innerHeight - 240) / 2),
        left: Math.max(20, (window.innerWidth - 360) / 2),
      });
    }
  }, [isOpen, currentStep]);

  // Update on step change, resize, and scroll
  useEffect(() => {
    if (!isOpen) return;

    updatePositions();
    const handleResize = () => updatePositions();
    const handleScroll = () => updatePositions();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, updatePositions, currentStepIndex]);

  // Keyboard navigation & accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipTour();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextStep, prevStep, skipTour]);

  // Trap focus inside popover when active
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [isOpen, currentStepIndex]);

  if (!isOpen || !currentStep) return null;

  const isLastStep = currentStepIndex === totalSteps - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('ariaTourDialog')}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* SVG Spotlight Mask */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto transition-opacity duration-300"
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx={10}
                ry={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Navy brand overlay backdrop with mask cutout */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 36, 70, 0.72)"
          mask="url(#tour-spotlight-mask)"
          onClick={skipTour}
        />
      </svg>

      {/* Spotlight Border Ring */}
      {targetRect && (
        <div
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
          className="fixed pointer-events-none rounded-xl border-2 border-[#FF8928] ring-4 ring-[#FF8928]/25 shadow-lg transition-all duration-200 z-50"
        />
      )}

      {/* Tour Popover Card */}
      <div
        ref={popoverRef}
        tabIndex={-1}
        style={{
          top: popoverPos ? `${popoverPos.top}px` : '50%',
          left: popoverPos ? `${popoverPos.left}px` : '50%',
          transform: popoverPos ? 'none' : 'translate(-50%, -50%)',
        }}
        className="fixed z-50 w-[min(360px,calc(100vw-32px))] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-5 text-gray-900 dark:text-gray-100 transition-all duration-200 outline-none"
      >
        {/* Header: Step counter + close button */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300 border border-accent-200 dark:border-accent-800">
            {t('stepBadge', { current: currentStepIndex + 1, total: totalSteps })}
          </span>

          <button
            onClick={skipTour}
            aria-label={t('close')}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-1.5 mb-5">
          <h2 id="tour-step-title" className="text-base font-bold text-[#002446] dark:text-white">
            {t(`steps.${currentStep.titleKey}`)}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {t(`steps.${currentStep.descKey}`)}
          </p>
        </div>

        {/* Footer: Progress dots + Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 gap-2">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx === currentStepIndex
                    ? 'w-5 bg-accent-500'
                    : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={prevStep}
                className="h-8 px-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                {t('back')}
              </Button>
            )}

            <Button
              size="sm"
              onClick={nextStep}
              className="h-8 px-3.5 text-xs font-semibold bg-[#002446] hover:bg-[#053561] text-white dark:bg-accent-500 dark:hover:bg-accent-600 dark:text-white rounded-lg shadow-xs transition-colors"
            >
              {isLastStep ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {t('finish')}
                </>
              ) : (
                <>
                  {t('next')}
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
