"use client"

import { Suspense, useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconMail,
  IconMailOpened,
  IconCheck,
  IconArchive,
  IconTrash,
  IconLoader2,
  IconExternalLink,
  IconCopy,
} from "@tabler/icons-react"

interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: string
  ipAddress: string | null
  createdAt: string
}

const statusColors: Record<string, string> = {
  UNREAD: "bg-blue-100 text-blue-800",
  READ: "bg-yellow-100 text-yellow-800",
  REPLIED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-100 text-gray-800",
}

const statusLabels: Record<string, string> = {
  UNREAD: "Unread",
  READ: "Read",
  REPLIED: "Replied",
  ARCHIVED: "Archived",
}

function ContactMessagesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const targetId = searchParams.get("id")

  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const handledTargetRef = useRef<string | null>(null)

  const updateStatus = useCallback(async (id: string, status: string, silent = false) => {
    try {
      const res = await fetch("/api/admin/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        if (!silent) {
          toast.success(`Marked as ${statusLabels[status]}`)
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status } : m))
        )
        setSelectedMessage((prev) =>
          prev?.id === id ? { ...prev, status } : prev
        )
      }
    } catch {
      if (!silent) {
        toast.error("Error updating message")
      }
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (targetId) params.set("id", targetId)

      const res = await fetch(`/api/admin/contact?${params}`)
      if (!res.ok) return

      const data = await res.json()
      let fetched: ContactMessage[] = data.messages || []
      const targetMsg: ContactMessage | null = data.targetMessage || null

      if (targetId && targetMsg) {
        const existsInList = fetched.some((m) => m.id === targetMsg.id)
        if (!existsInList) {
          fetched = [targetMsg, ...fetched]
        }
      }

      setMessages(fetched)
      setTotal(data.total || 0)

      if (targetId && handledTargetRef.current !== targetId) {
        handledTargetRef.current = targetId
        const found = fetched.find((m) => m.id === targetId) || targetMsg
        if (found) {
          setSelectedMessage(found)
          setHighlightedId(found.id)
          if (found.status === "UNREAD") {
            updateStatus(found.id, "READ", true)
          }
        } else {
          toast.error("This contact message could not be found")
        }
      }
    } catch {
      toast.error("Error loading messages")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, targetId, updateStatus])

  useEffect(() => {
    if (targetId && statusFilter) {
      setStatusFilter("")
    }
  }, [targetId, statusFilter])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (!highlightedId || loading) return
    const el = itemRefs.current[highlightedId]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [highlightedId, messages, loading])

  const deleteMessage = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/contact?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Message deleted")
        setConfirmDeleteId(null)
        setSelectedMessage((prev) => (prev?.id === id ? null : prev))
        if (highlightedId === id) setHighlightedId(null)
        if (targetId === id) router.replace("/admin/contact")
        fetchMessages()
      }
    } catch {
      toast.error("Error deleting message")
    }
  }

  const handleSelect = async (msg: ContactMessage) => {
    setSelectedMessage(msg)
    setHighlightedId(msg.id)
    setConfirmDeleteId(null)
    if (msg.status === "UNREAD") {
      await updateStatus(msg.id, "READ")
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }

  const getGmailComposeUrl = (msg: ContactMessage) => {
    const subject = `Re: ${msg.subject}`
    const body = `\n\n---\nOn ${formatDate(msg.createdAt)}, ${msg.name} <${msg.email}> wrote:\n${msg.message}`
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: msg.email,
      su: subject,
      body,
    })
    return `https://mail.google.com/mail/?${params.toString()}`
  }

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      toast.success("Email copied to clipboard")
    } catch {
      toast.error("Could not copy email")
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contact Messages</h1>
          <p className="text-sm text-muted-foreground">{total} messages</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["", "UNREAD", "READ", "REPLIED", "ARCHIVED"].map((s) => (
            <button
              key={s}
              onClick={() => {
                if (targetId) router.replace("/admin/contact")
                setStatusFilter(s)
              }}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s ? statusLabels[s] : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
        {/* Message List */}
        <div className="border rounded-lg overflow-hidden max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No messages
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id
                const isHighlighted = highlightedId === msg.id

                return (
                  <button
                    key={msg.id}
                    ref={(el) => {
                      itemRefs.current[msg.id] = el
                    }}
                    onClick={() => handleSelect(msg)}
                    className={`w-full text-left p-4 transition-all border-l-4 ${
                      isHighlighted
                        ? "border-l-primary bg-primary/10 ring-1 ring-inset ring-primary/30"
                        : isSelected
                          ? "border-l-primary bg-muted"
                          : "border-l-transparent hover:bg-muted/50"
                    } ${msg.status === "UNREAD" ? "font-semibold" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm truncate max-w-[200px]">{msg.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isHighlighted && targetId === msg.id && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                            Selected
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[msg.status]}`}>
                          {statusLabels[msg.status]}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-medium truncate">{msg.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(msg.createdAt)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="border rounded-lg p-6">
          {selectedMessage ? (
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold">{selectedMessage.subject}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[selectedMessage.status]}`}>
                      {statusLabels[selectedMessage.status]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateStatus(selectedMessage.id, "UNREAD")}
                    className="p-2 hover:bg-muted rounded"
                    title="Mark as unread"
                  >
                    <IconMail className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateStatus(selectedMessage.id, "REPLIED")}
                    className="p-2 hover:bg-muted rounded"
                    title="Mark as replied"
                  >
                    <IconCheck className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateStatus(selectedMessage.id, "ARCHIVED")}
                    className="p-2 hover:bg-muted rounded"
                    title="Archive"
                  >
                    <IconArchive className="w-4 h-4" />
                  </button>
                  {confirmDeleteId === selectedMessage.id ? (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => deleteMessage(selectedMessage.id)}
                        className="px-2 py-1 text-xs font-medium rounded bg-destructive text-destructive-foreground hover:opacity-90"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground hover:bg-muted/80"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(selectedMessage.id)}
                      className="p-2 hover:bg-destructive/10 rounded text-destructive"
                      title="Delete"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground w-16">From:</span>
                  <span className="font-medium">{selectedMessage.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground w-16">Email:</span>
                  <div className="flex items-center gap-2">
                    <a href={`mailto:${selectedMessage.email}`} className="text-primary hover:underline">
                      {selectedMessage.email}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyEmail(selectedMessage.email)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                      title="Copy email"
                    >
                      <IconCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground w-16">Date:</span>
                  <span>{formatDate(selectedMessage.createdAt)}</span>
                </div>
                {selectedMessage.ipAddress && (
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground w-16">IP:</span>
                    <span className="text-muted-foreground">{selectedMessage.ipAddress}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedMessage.message}</p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={getGmailComposeUrl(selectedMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                  onClick={() => {
                    if (selectedMessage.status !== "REPLIED") {
                      updateStatus(selectedMessage.id, "REPLIED")
                    }
                  }}
                >
                  <IconExternalLink className="w-4 h-4" />
                  Open in Gmail
                </a>
                <a
                  href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(`Re: ${selectedMessage.subject}`)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium hover:bg-muted transition-colors"
                  onClick={() => {
                    if (selectedMessage.status !== "REPLIED") {
                      updateStatus(selectedMessage.id, "REPLIED")
                    }
                  }}
                >
                  <IconMail className="w-4 h-4" />
                  Reply via Email
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <IconMailOpened className="w-12 h-12 mb-4 opacity-30" />
              <p>Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ContactMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center py-16">
          <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ContactMessagesContent />
    </Suspense>
  )
}
