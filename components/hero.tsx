import Image from "next/image"
import Link from "next/link"

interface HeroProps {
  backgroundImage?: string
  videoUrl?: string | null
  linkUrl?: string | null
  openInNewTab?: boolean
}

export function Hero({
  backgroundImage,
  videoUrl,
  linkUrl,
  openInNewTab = false,
}: HeroProps) {
  const safeBackgroundImage = backgroundImage?.trim() || undefined
  const safeVideoUrl = videoUrl?.trim() || undefined
  const imageSrc = safeBackgroundImage || (!safeVideoUrl ? "/images/background.png" : undefined)

  const content = (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: "var(--global-bg)" }}>
      {/* Imagen siempre de base cuando existe: hace de póster mientras el video carga */}
      {imageSrc && (
        <Image
          src={imageSrc}
          alt="Background"
          fill
          className="object-cover object-center"
          priority
        />
      )}
      {safeVideoUrl && (
        <video
          src={safeVideoUrl}
          poster={imageSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  )

  if (linkUrl) {
    if (openInNewTab) {
      return (
        <a href={linkUrl} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      )
    }
    return <Link href={linkUrl}>{content}</Link>
  }

  return content
}
