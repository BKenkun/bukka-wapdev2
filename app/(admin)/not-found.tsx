import Link from "next/link"
import { Home, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[65vh] px-4 py-16 text-center">
      <p className="text-xs font-medium tracking-wide text-muted-foreground mb-4">
        Error 404 · Recurso no encontrado
      </p>

      <div
        className="text-7xl sm:text-8xl font-black tracking-tight tabular-nums leading-none text-foreground select-none"
        aria-hidden="true"
      >
        404
      </div>

      <div className="h-[2px] w-12 bg-primary my-6" aria-hidden="true" />

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance mb-3">
        Esta página no existe
      </h1>

      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        La ruta o el elemento que buscas no está disponible o ha sido eliminado.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/" className="whitespace-nowrap shrink-0">
            <Home className="w-4 h-4 mr-2" aria-hidden="true" />
            Volver a la Home
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin" className="whitespace-nowrap shrink-0">
            <LayoutDashboard className="w-4 h-4 mr-2" aria-hidden="true" />
            Ir al panel de Admin
          </Link>
        </Button>
      </div>
    </div>
  )
}
