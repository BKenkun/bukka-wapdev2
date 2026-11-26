"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconGripVertical,
  IconPencil,
  IconToggleLeft,
  IconToggleRight,
  IconPhoto,
  IconVideo,
  IconUsers,
  IconBrandCampaignmonitor,
  IconClock,
  IconLayoutGrid,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HomeSectionType } from "@prisma/client"
import { HomeSectionEditor } from "./home-section-editor"
import {
  getEffectiveBgSource,
  getNormalizedManualVideoIds,
  type UnifiedBannerConfig,
} from "@/lib/banner-config"

interface HomeSection {
  id: string
  type: HomeSectionType
  title: string | null
  enabled: boolean
  order: number
  config: Record<string, unknown> | null
}

interface TypeConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const sectionTypeConfig: Record<string, TypeConfig> = {
  HERO: { label: "Hero", icon: IconPhoto, color: "text-purple-500" },
  VIDEO_GRID: { label: "Grid de Vídeos", icon: IconVideo, color: "text-blue-500" },
  ACTRESS_GRID: { label: "Grid de Modelos", icon: IconUsers, color: "text-pink-500" },
  CTA_BANNER: { label: "Banner CTA", icon: IconBrandCampaignmonitor, color: "text-orange-500" },
  COUNTDOWN: { label: "Upcoming Scene", icon: IconClock, color: "text-green-500" },
  CATEGORY_FEATURED: { label: "Categoría Destacada", icon: IconLayoutGrid, color: "text-yellow-500" },
}

interface Page {
  id: string
  title: string
  slug: string
}

interface Tag {
  id: string
  name: string
  slug: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface HomeSectionListProps {
  sections: HomeSection[]
  pages: Page[]
  tags: Tag[]
  categories: Category[]
}

const VIDEO_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  latest: "Últimos vídeos",
  popular: "Más populares",
  popular_weekly: "Más vistos (semana)",
  trending: "Tendencias",
  category: "Por categoría",
  tag: "Por tag",
}

const ROTATION_LABELS: Record<string, string> = {
  fixed: "Fijo",
  sequential: "Rotación en orden",
  random: "Rotación aleatoria",
}

export function HomeSectionList({ sections, pages, tags, categories }: HomeSectionListProps) {
  const typeConfig = sectionTypeConfig
  const router = useRouter()
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/home-sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        const text = await response.text()
        console.error("Error toggling section:", response.status, text)
        alert(`Error: ${text}`)
      }
    } catch (error) {
      console.error("Error toggling section:", error)
      alert(`Error de red: ${error}`)
    }
  }

  const handleSave = async (id: string, data: Partial<HomeSection>) => {
    try {
      const response = await fetch(`/api/admin/home-sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        setEditingSection(null)
        router.refresh()
      } else {
        const text = await response.text()
        console.error("Error saving section:", response.status, text)
        alert(`Error al guardar: ${text}`)
      }
    } catch (error) {
      console.error("Error saving section:", error)
      alert(`Error de red: ${error}`)
    }
  }

  const handleReorder = async (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return

    setIsReordering(true)
    const newOrder = [...sections]
    const [removed] = newOrder.splice(dragIndex, 1)
    newOrder.splice(dropIndex, 0, removed)

    try {
      const response = await fetch("/api/admin/home-sections/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newOrder.map((s) => s.id) }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error("Error reordering sections:", error)
    } finally {
      setIsReordering(false)
    }
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No hay secciones configuradas</p>
        <p className="text-sm mt-2">Ejecuta el seed para crear las secciones iniciales</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {sections.map((section, index) => {
          const config = typeConfig[section.type]
          const Icon = config?.icon

          return (
            <div
              key={section.id}
              className={`flex items-center gap-4 p-4 rounded-lg border ${
                section.enabled
                  ? "bg-card border-border"
                  : "bg-muted/50 border-muted opacity-60"
              }`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", index.toString())
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dragIndex = parseInt(e.dataTransfer.getData("text/plain"))
                handleReorder(dragIndex, index)
              }}
            >
              <div className="cursor-grab text-muted-foreground hover:text-foreground">
                <IconGripVertical className="size-5" />
              </div>

              <div className="flex-shrink-0">
                {Icon && <Icon className={`size-6 ${config.color}`} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {section.title || config?.label || section.type}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {config?.label}
                  </Badge>
                </div>
                {section.type === "VIDEO_GRID" && section.config && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Fuente: {(section.config as { source?: string }).source || "N/A"} |
                    Límite: {(section.config as { limit?: number }).limit || "N/A"}
                  </p>
                )}
                {(section.type === "HERO" || section.type === "CTA_BANNER") && section.config && (() => {
                  const cfg = section.config as UnifiedBannerConfig
                  const bgSource = getEffectiveBgSource(cfg, section.type)
                  const parts: string[] = []
                  if (bgSource === "dbVideo") {
                    const src = cfg.dbVideoSource || "manual"
                    if (src === "manual") {
                      const count = getNormalizedManualVideoIds(cfg).length
                      parts.push(`Vídeo web · Manual (${count} ${count === 1 ? "vídeo" : "vídeos"})`)
                    } else {
                      parts.push(`Vídeo web · ${VIDEO_SOURCE_LABELS[src] || src}`)
                    }
                    parts.push(ROTATION_LABELS[cfg.rotationMode || "fixed"] || "Fijo")
                  } else if (bgSource === "uploadedVideo") {
                    parts.push("Vídeo subido")
                  } else {
                    parts.push("Imagen de fondo")
                  }
                  if (cfg.title) {
                    parts.push(cfg.title)
                  }
                  return (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {parts.join(" · ")}
                    </p>
                  )
                })()}
                {section.type === "COUNTDOWN" && section.config && (() => {
                  const cfg = section.config as {
                    mode?: string
                    videoId?: string
                    videoTitle?: string
                    targetDate?: string
                    newReleaseWindowDays?: number
                  }
                  const effectiveMode = cfg.mode || (cfg.videoId ? "auto" : cfg.targetDate ? "manual" : "auto")
                  return (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {effectiveMode === "auto"
                        ? cfg.videoTitle
                          ? `Automático · Vídeo: ${cfg.videoTitle}`
                          : "Automático · Piloto automático (próximo estreno / último vídeo)"
                        : `Manual · Fecha: ${cfg.targetDate || "Sin fecha"}`}
                    </p>
                  )
                })()}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggle(section.id, section.enabled)}
                  title={section.enabled ? "Desactivar" : "Activar"}
                >
                  {section.enabled ? (
                    <IconToggleRight className="size-5 text-green-500" />
                  ) : (
                    <IconToggleLeft className="size-5 text-muted-foreground" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSection(section)}
                >
                  <IconPencil className="size-4 mr-2" />
                  Editar
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {editingSection && (
        <HomeSectionEditor
          section={editingSection}
          pages={pages}
          tags={tags}
          categories={categories}
          onSave={handleSave}
          onClose={() => setEditingSection(null)}
        />
      )}
    </>
  )
}
