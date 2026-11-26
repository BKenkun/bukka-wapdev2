"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react"

interface Photo {
  id?: string
  imageUrl: string
  caption?: string | null
}

interface PhotoGalleryCarouselProps {
  photos: Photo[]
  performerName: string
}

export function PhotoGalleryCarousel({ photos, performerName }: PhotoGalleryCarouselProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Only photos inside [start, end] mount <Image>; null when gallery is off-screen vertically
  const [visibleRange, setVisibleRange] = useState<[number, number] | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const hasDragged = useRef(false)
  const dragStartX = useRef(0)
  const dragScrollLeft = useRef(0)

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(photos.length > 1)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const photoCount = photos.length

  const computeVisibility = useCallback(() => {
    const sectionEl = sectionRef.current
    const el = scrollRef.current
    if (!sectionEl || !el || photoCount === 0) return

    // Update scroll arrows and progress bar
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4)
    setScrollProgress(maxScroll > 0 ? Math.min(1, Math.max(0, el.scrollLeft / maxScroll)) : 0)

    // 1) Check if gallery section is visible vertically in the viewport
    const secRect = sectionEl.getBoundingClientRect()
    const verticalBuffer = 120
    const isVerticallyVisible =
      secRect.height > 0 &&
      secRect.bottom >= -verticalBuffer &&
      secRect.top <= window.innerHeight + verticalBuffer

    if (!isVerticallyVisible) {
      setVisibleRange((prev) => (prev === null ? prev : null))
      return
    }

    // 2) Compute the exact contiguous slice [start, end] of horizontally visible slides
    const horizontalBuffer = 120
    const viewLeft = el.scrollLeft - horizontalBuffer
    const viewRight = el.scrollLeft + el.clientWidth + horizontalBuffer

    let start = -1
    let end = -1
    const children = el.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      const left = child.offsetLeft
      const right = left + child.offsetWidth
      if (right >= viewLeft && left <= viewRight) {
        if (start === -1) start = i
        end = i
      } else if (left > viewRight) {
        break
      }
    }

    if (start === -1 || end === -1) {
      setVisibleRange((prev) => (prev === null ? prev : null))
      return
    }

    setVisibleRange((prev) => {
      if (prev && prev[0] === start && prev[1] === end) return prev
      return [start, end]
    })
  }, [photoCount])

  useEffect(() => {
    const sectionEl = sectionRef.current
    const el = scrollRef.current
    if (!sectionEl || !el || photoCount === 0) return

    let rafId: number | null = null
    const scheduleCompute = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        computeVisibility()
      })
    }

    scheduleCompute()
    el.addEventListener("scroll", scheduleCompute, { passive: true })
    window.addEventListener("scroll", scheduleCompute, { passive: true })
    window.addEventListener("resize", scheduleCompute, { passive: true })

    // Also observe section visibility changes & container resizes (e.g. layout shifts)
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(() => scheduleCompute(), { rootMargin: "120px 0px" })
        : null
    io?.observe(sectionEl)

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleCompute()) : null
    ro?.observe(el)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      el.removeEventListener("scroll", scheduleCompute)
      window.removeEventListener("scroll", scheduleCompute)
      window.removeEventListener("resize", scheduleCompute)
      io?.disconnect()
      ro?.disconnect()
    }
  }, [photoCount, computeVisibility])

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const scrollAmount = el.clientWidth * 0.8
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    })
  }

  const handleDragStart = (clientX: number) => {
    const el = scrollRef.current
    if (!el) return
    setIsDragging(true)
    hasDragged.current = false
    dragStartX.current = clientX
    dragScrollLeft.current = el.scrollLeft
  }

  const handleDragMove = (clientX: number) => {
    if (!isDragging) return
    const el = scrollRef.current
    if (!el) return
    const dx = clientX - dragStartX.current
    if (Math.abs(dx) > 5) hasDragged.current = true
    el.scrollLeft = dragScrollLeft.current - dx
  }

  const handleDragEnd = () => setIsDragging(false)

  const handleClick = (realIndex: number) => {
    if (hasDragged.current) return
    setLightboxIndex(realIndex)
  }

  // Lightbox navigation across the entire photo collection
  const lightboxPrev = useCallback(
    () =>
      setLightboxIndex((prev) =>
        prev !== null && photoCount > 0 ? (prev - 1 + photoCount) % photoCount : null
      ),
    [photoCount]
  )
  const lightboxNext = useCallback(
    () =>
      setLightboxIndex((prev) =>
        prev !== null && photoCount > 0 ? (prev + 1) % photoCount : null
      ),
    [photoCount]
  )

  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null)
      if (e.key === "ArrowLeft") lightboxPrev()
      if (e.key === "ArrowRight") lightboxNext()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [lightboxIndex, lightboxPrev, lightboxNext])

  const arrowStyle: React.CSSProperties = {
    width: "var(--carousel-arrow-size, 44px)",
    height: "var(--carousel-arrow-size, 44px)",
    backgroundColor: "var(--carousel-arrow-bg, #1A1A1A)",
    borderColor: "var(--carousel-arrow-border, #FA4860)",
    borderWidth: "var(--carousel-arrow-border-width, 2px)",
    borderStyle: "solid",
    borderRadius: "var(--carousel-arrow-radius, 50%)",
    color: "var(--carousel-arrow-icon, #FFFFFF)",
  }

  if (photoCount === 0) return null

  return (
    <>
      <section ref={sectionRef} className="w-full relative group/carousel">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer hover:scale-110"
            style={arrowStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--carousel-arrow-hover-bg, #000000)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--carousel-arrow-bg, #1A1A1A)"
            }}
            aria-label="Previous photos"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer hover:scale-110"
            style={arrowStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--carousel-arrow-hover-bg, #000000)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--carousel-arrow-bg, #1A1A1A)"
            }}
            aria-label="Next photos"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Scrollable container across all photos; off-screen photos stay unmounted until visible */}
        <div
          ref={scrollRef}
          className="relative flex gap-3 sm:gap-4 overflow-x-auto select-none"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            cursor: isDragging ? "grabbing" : "grab",
            WebkitOverflowScrolling: "touch",
          }}
          onMouseDown={(e) => {
            e.preventDefault()
            handleDragStart(e.clientX)
          }}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
        >
          {photos.map((photo, index) => {
            const shouldMountImage =
              visibleRange !== null && index >= visibleRange[0] && index <= visibleRange[1]

            return (
              <div
                key={photo.id || index}
                data-photo-index={index}
                className="flex-shrink-0 w-[60vw] sm:w-[42vw] md:w-[32vw] lg:w-[25vw] xl:w-[20vw] 2xl:w-[17vw]"
                onClick={() => handleClick(index)}
              >
                <div
                  className="relative w-full aspect-[9/16] overflow-hidden group cursor-pointer"
                  style={{ backgroundColor: "var(--surface-bg, #1a1a1a)" }}
                >
                  {shouldMountImage && (
                    <Image
                      src={photo.imageUrl}
                      alt={photo.caption || `${performerName} photo ${index + 1}`}
                      fill
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 60vw, (max-width: 1200px) 32vw, 20vw"
                    />
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Hairline scroll progress bar & photo count when gallery overflows */}
        {(canScrollLeft || canScrollRight) && (
          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex-1 h-[2px] overflow-hidden"
              style={{ backgroundColor: "var(--border-color, #262626)" }}
            >
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${Math.max(8, scrollProgress * 100)}%`,
                  backgroundColor: "var(--brand-color, #FA4860)",
                }}
              />
            </div>
            <span
              className="text-xs font-medium tabular-nums flex-shrink-0"
              style={{ color: "var(--text-muted, #999999)" }}
            >
              {photoCount} photos
            </span>
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="absolute inset-0 bg-black/90" />

          {/* Close */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 p-2 cursor-pointer hover:opacity-70 text-white"
            aria-label="Close lightbox"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Prev */}
          {photoCount > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                lightboxPrev()
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
              style={arrowStyle}
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next */}
          {photoCount > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                lightboxNext()
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
              style={arrowStyle}
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative max-w-[90vw] max-h-[90vh] w-auto h-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              key={photos[lightboxIndex].id || lightboxIndex}
              src={photos[lightboxIndex].imageUrl}
              alt={photos[lightboxIndex].caption || `${performerName} photo ${lightboxIndex + 1}`}
              width={800}
              height={1200}
              className="object-contain max-h-[90vh] w-auto"
              referrerPolicy="no-referrer"
              priority
            />
          </div>

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm tabular-nums">
            {lightboxIndex + 1} / {photoCount}
          </div>
        </div>
      )}
    </>
  )
}
