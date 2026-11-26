"use client"

interface StickyHeaderProps {
  children: React.ReactNode
  topBar: React.ReactNode
  searchBar?: React.ReactNode
  discountBanner?: React.ReactNode
}

export function StickyHeader({ children, topBar, searchBar, discountBanner }: StickyHeaderProps) {
  // Barra de navegación siempre con color sólido y contenido (hero) debajo,
  // usando CSS position: sticky nativo para evitar saltos de altura y bucles ResizeObserver.
  const showBackground = true
  const showTopBar = true
  const showSearchBar = false // Search is now an icon in header actions
  const showDiscountBanner = true

  return (
    <div
      className="sticky top-0 left-0 right-0 z-50 w-full transition-colors duration-300"
      style={{ backgroundColor: showBackground ? "var(--global-bg)" : "transparent" }}
    >
      {/* Top Bar */}
      <div
        className={`transition-[max-height,opacity] duration-300 overflow-hidden ${
          showTopBar ? "max-h-[36px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {topBar}
      </div>

      {/* Search Bar - between TopBar and MainHeader */}
      {searchBar && (
        <div
          className={`transition-[max-height,opacity] duration-300 overflow-hidden ${
            showSearchBar ? "max-h-[60px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {searchBar}
        </div>
      )}

      {/* Main Header (children) */}
      {children}

      {/* Discount Banner */}
      {discountBanner && (
        <div
          className={`transition-[max-height,opacity] duration-300 overflow-hidden ${
            showDiscountBanner ? "max-h-[160px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {discountBanner}
        </div>
      )}
    </div>
  )
}
