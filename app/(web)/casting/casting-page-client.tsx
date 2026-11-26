"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Bell,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Video,
} from "lucide-react"
import { toast } from "sonner"
import { castingFormSchema } from "@/lib/validations/casting"
import {
  formatCastingDate,
  formatCastingDateRange,
  type PublicCastingSettings,
} from "@/lib/casting-dates"

const STEPS = [
  { id: 1, label: "DNI" },
  { id: 2, label: "Photos & Video" },
  { id: 3, label: "Personal Info" },
  { id: 4, label: "Physical" },
  { id: 5, label: "Final" },
]

interface CastingPageClientProps {
  settings: PublicCastingSettings
}

const inputBaseClass =
  "px-4 py-[13px] w-full border transition-colors focus:outline-none focus:border-[var(--form-input-focus-border)] bg-[var(--form-input-bg)] border-[var(--form-input-border)] text-[var(--form-input-text)]"

const labelBaseClass = "text-sm font-medium mb-2 block text-[var(--form-label-color)]"

export function CastingPageClient({ settings }: CastingPageClientProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationPassed, setVerificationPassed] = useState(false)
  const [verificationSimilarity, setVerificationSimilarity] = useState<number | null>(null)

  // Notify-me form when casting is closed
  const [alertEmail, setAlertEmail] = useState("")
  const [isSubscribingAlert, setIsSubscribingAlert] = useState(false)
  const [alertSubscribed, setAlertSubscribed] = useState(false)

  const [formData, setFormData] = useState({
    fullName: "",
    birthDate: "",
    email: "",
    phone: "",
    gender: "",
    height: "",
    weight: "",
    bust: "",
    waist: "",
    hips: "",
    hairColor: "",
    eyeColor: "",
    skinTone: "",
    tattoos: "",
    experience: "",
    additionalInfo: "",
    socialMedia: "",
    socialMedia2: "",
  })

  const [files, setFiles] = useState<{
    dniFront: File | null
    dniBack: File | null
    generalPhotos: File[]
    presentationVideo: File | null
  }>({
    dniFront: null,
    dniBack: null,
    generalPhotos: [],
    presentationVideo: null,
  })

  const formattedOpenDate = formatCastingDate(settings.applicationsOpenDate)
  const formattedCloseDate = formatCastingDate(settings.applicationsCloseDate)
  const formattedAuditions = formatCastingDateRange(
    settings.auditionsStartDate,
    settings.auditionsEndDate
  )
  const formattedResults = formatCastingDate(settings.resultsDate)

  const hasAnyDate = Boolean(
    formattedOpenDate || formattedCloseDate || formattedAuditions || formattedResults
  )
  const showDatesCard = settings.showImportantDates && hasAnyDate

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("folder", folder)
    const response = await fetch("/api/upload", { method: "POST", body: fd })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Error uploading file")
    }
    const result = await response.json()
    return result.url
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return
    if (fieldName === "generalPhotos") {
      setFiles((prev) => ({ ...prev, generalPhotos: Array.from(selectedFiles) }))
    } else if (fieldName === "dniFront") {
      setFiles((prev) => ({ ...prev, dniFront: selectedFiles[0] || null }))
    } else if (fieldName === "dniBack") {
      setFiles((prev) => ({ ...prev, dniBack: selectedFiles[0] || null }))
    } else if (fieldName === "presentationVideo") {
      setFiles((prev) => ({ ...prev, presentationVideo: selectedFiles[0] || null }))
    }
  }

  const handleVerification = async () => {
    if (files.generalPhotos.length === 0) {
      toast.error("Upload at least one general photo for verification")
      return
    }

    setIsVerifying(true)
    try {
      const fd = new FormData()
      fd.append("dniPhoto", files.dniFront!)
      fd.append("selfiePhoto", files.generalPhotos[0])

      const res = await fetch("/api/casting/verify", { method: "POST", body: fd })
      const data = await res.json()

      if (data.serviceError) {
        toast.error(data.error || "Verification service error. Please try again.")
        return
      }

      if (data.verified) {
        setVerificationPassed(true)
        setVerificationSimilarity(data.similarity)
        toast.success("Identity verified successfully")
        setCurrentStep(3)
      } else {
        setFiles({ dniFront: null, dniBack: null, generalPhotos: [], presentationVideo: null })
        setVerificationPassed(false)
        setVerificationSimilarity(null)
        setCurrentStep(1)

        const inputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>
        inputs.forEach((input) => {
          input.value = ""
        })

        toast.error(
          data.error ||
            "We could not verify your identity. The photos have been deleted. Please try again with clearer photos.",
          { duration: 8000 }
        )
      }
    } catch {
      toast.error("Verification error. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const goNext = () => {
    if (currentStep === 1) {
      if (!files.dniFront || !files.dniBack) {
        toast.error("Upload both sides of your ID to continue")
        return
      }
    }

    if (currentStep === 2) {
      handleVerification()
      return
    }

    if (currentStep === 3) {
      const stepErrors: Record<string, string> = {}
      if (!formData.fullName.trim()) stepErrors.fullName = "Required"
      if (!formData.email.trim()) stepErrors.email = "Required"
      if (!formData.birthDate) stepErrors.birthDate = "Required"
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        return
      }
    }

    setErrors({})
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
  }

  const goBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1))

  const handleSubmit = async () => {
    const result = castingFormSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message
      })
      setErrors(fieldErrors)
      toast.error("Please fix the form errors")
      if (fieldErrors.fullName || fieldErrors.email || fieldErrors.birthDate || fieldErrors.phone) {
        setCurrentStep(3)
      }
      return
    }
    setErrors({})
    setIsSubmitting(true)
    setIsUploading(true)

    try {
      let dniPhotoUrl: string | null = null
      let dniBackUrl: string | null = null
      const generalPhotoUrls: string[] = []
      let videoUrl: string | null = null

      if (files.dniFront) {
        toast.info("Uploading DNI (front)...")
        dniPhotoUrl = await uploadFile(files.dniFront, "casting")
      }
      if (files.dniBack) {
        toast.info("Uploading DNI (back)...")
        dniBackUrl = await uploadFile(files.dniBack, "casting")
      }
      if (files.generalPhotos.length > 0) {
        toast.info("Uploading photos...")
        for (const photo of files.generalPhotos) {
          const url = await uploadFile(photo, "casting")
          if (url) generalPhotoUrls.push(url)
        }
      }
      if (files.presentationVideo) {
        toast.info("Uploading video...")
        videoUrl = await uploadFile(files.presentationVideo, "casting-video")
      }
      setIsUploading(false)

      toast.info("Saving application...")
      const response = await fetch("/api/casting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone || null,
          birthDate: formData.birthDate,
          gender: formData.gender || null,
          height: formData.height || null,
          weight: formData.weight || null,
          bust: formData.bust || null,
          waist: formData.waist || null,
          hips: formData.hips || null,
          hairColor: formData.hairColor || null,
          eyeColor: formData.eyeColor || null,
          skinTone: formData.skinTone || null,
          tattoos: formData.tattoos || null,
          experience: formData.experience || null,
          additionalInfo: formData.additionalInfo || null,
          instagram: formData.socialMedia || null,
          twitter: formData.socialMedia2 || null,
          dniPhotoUrl,
          dniBackUrl,
          generalPhotos: generalPhotoUrls,
          videoUrl,
          identityVerified: verificationPassed,
          identitySimilarity: verificationSimilarity,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error submitting application")
      }

      setIsSubmitted(true)
      toast.success("Application submitted successfully")
    } catch (error) {
      console.error("Error:", error)
      toast.error(error instanceof Error ? error.message : "Error submitting application")
    } finally {
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  const handleSubscribeAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alertEmail.trim()) {
      toast.error("Please enter your email address")
      return
    }
    setIsSubscribingAlert(true)
    try {
      const res = await fetch("/api/casting/notify-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: alertEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Could not subscribe")
      }
      setAlertSubscribed(true)
      toast.success("You're on the list! We'll email you when casting opens.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not subscribe")
    } finally {
      setIsSubscribingAlert(false)
    }
  }

  const uploadBtnStyle: React.CSSProperties = {
    backgroundColor: "var(--accent-color)",
    color: "var(--btn-primary-text)",
    borderRadius: "var(--btn-primary-radius)",
  }

  if (isSubmitted) {
    return (
      <main
        className="min-h-screen pt-8 pb-16"
        style={{
          backgroundColor: "var(--global-bg)",
          color: "var(--text-primary)",
          fontFamily: "var(--global-font)",
        }}
      >
        <div className="px-4 md:px-8 max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div
              className="w-20 h-20 flex items-center justify-center mx-auto mb-6"
              style={{
                backgroundColor: "color-mix(in srgb, var(--success-color) 18%, transparent)",
              }}
            >
              <Check className="w-10 h-10" style={{ color: "var(--success-color)" }} />
            </div>
            <h1 className="text-3xl font-bold mb-4">Application Submitted!</h1>
            <p className="text-lg mb-8" style={{ color: "var(--text-muted)" }}>
              We have received your casting application. Our team will review it and contact you soon.
            </p>
          </div>
          <div
            className="p-6 mb-8 border"
            style={{
              backgroundColor: "var(--surface-bg)",
              borderColor: "var(--border-color)",
            }}
          >
            <h2 className="font-semibold mb-4">What&apos;s next?</h2>
            <ul className="text-left space-y-3">
              {[
                "We will review your profile and portfolio in the coming days.",
                "If your profile is selected, we will contact you by email.",
                "We will schedule an in-person or virtual audition.",
              ].map((stepText, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div
                    className="w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{
                      backgroundColor: "var(--accent-color)",
                      color: "var(--btn-primary-text)",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <span style={{ color: "var(--text-secondary)" }}>{stepText}</span>
                </li>
              ))}
            </ul>
          </div>
          <button onClick={() => router.push("/")} className="btn-primary">
            Back to Home
          </button>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen pt-8 pb-16"
      style={{
        backgroundColor: "var(--global-bg)",
        color: "var(--text-primary)",
        fontFamily: "var(--global-font)",
      }}
    >
      {/* Verification overlay */}
      {isVerifying && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div
            className="p-8 max-w-sm mx-4 text-center shadow-2xl border"
            style={{
              backgroundColor: "var(--surface-bg)",
              borderColor: "color-mix(in srgb, var(--accent-color) 40%, transparent)",
            }}
          >
            <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Loader2
                className="animate-spin w-20 h-20"
                style={{ color: "var(--accent-color)" }}
              />
              <ShieldCheck
                className="w-8 h-8 absolute"
                style={{ color: "var(--accent-color)" }}
              />
            </div>
            <h3 className="text-xl font-bold mb-2">Verifying identity</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              We are comparing your ID photo with your personal photo. This will only take a few seconds...
            </p>
          </div>
        </div>
      )}

      <div className="px-4 md:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div
            className="sticky top-24 border p-6 shadow-lg"
            style={{
              backgroundColor: "var(--surface-bg)",
              borderColor: "var(--border-color)",
            }}
          >
            <h2 className="text-2xl font-bold mb-6">Casting Information</h2>

            <div
              className="mb-6 border-l-4 pl-4"
              style={{ borderLeftColor: "var(--accent-color)" }}
            >
              <h3 className="text-base font-semibold mb-4 leading-6">General Requirements</h3>
              <ul className="space-y-3">
                {[
                  "Age: 18-35 years",
                  "Previous experience desirable",
                  "Full availability",
                  "Updated portfolio",
                ].map((req) => (
                  <li key={req} className="flex items-start gap-2">
                    <Check
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: "var(--brand-color)" }}
                    />
                    <span className="text-sm font-normal" style={{ color: "var(--text-secondary)" }}>
                      {req}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="mb-6 border-l-4 pl-4"
              style={{ borderLeftColor: "var(--accent-color)" }}
            >
              <h3 className="text-base font-semibold mb-4 leading-6">Selection Process</h3>
              <ul className="space-y-3">
                {[
                  "Online application",
                  "Portfolio review",
                  "In-person audition",
                  "Final selection",
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 flex items-center justify-center font-semibold flex-shrink-0"
                      style={{
                        backgroundColor: "var(--accent-color)",
                        color: "var(--btn-primary-text)",
                      }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {step}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {showDatesCard && (
              <div
                className="p-5 border"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--brand-color) 18%, transparent)",
                  borderColor: "color-mix(in srgb, var(--brand-color) 35%, transparent)",
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5" style={{ color: "var(--brand-color)" }} />
                  <h3
                    className="text-base font-semibold leading-normal"
                    style={{ color: "var(--brand-color)" }}
                  >
                    Important Dates
                  </h3>
                </div>
                <div className="space-y-2">
                  {formattedOpenDate && settings.closedReason === "not_yet_open" && (
                    <p className="text-sm leading-5">
                      <span className="font-bold">Applications open:</span>{" "}
                      <span className="font-normal">{formattedOpenDate}</span>
                    </p>
                  )}
                  {formattedCloseDate && (
                    <p className="text-sm leading-5">
                      <span className="font-bold">Applications close:</span>{" "}
                      <span className="font-normal">{formattedCloseDate}</span>
                    </p>
                  )}
                  {formattedAuditions && (
                    <p className="text-sm leading-5">
                      <span className="font-bold">Auditions:</span>{" "}
                      <span className="font-normal">{formattedAuditions}</span>
                    </p>
                  )}
                  {formattedResults && (
                    <p className="text-sm leading-5">
                      <span className="font-bold">Results:</span>{" "}
                      <span className="font-normal">{formattedResults}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main form area OR Closed Campaign notice */}
        <div className="lg:col-span-2">
          {!settings.isEffectivelyOpen ? (
            <div
              className="border p-8 md:p-10 space-y-6"
              style={{
                backgroundColor: "var(--surface-bg)",
                borderColor: "var(--border-color)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--brand-color) 18%, transparent)",
                  }}
                >
                  <Clock className="w-6 h-6" style={{ color: "var(--brand-color)" }} />
                </div>
                <div>
                  <p
                    className="text-xs uppercase tracking-wider font-semibold"
                    style={{ color: "var(--brand-color)" }}
                  >
                    {settings.closedReason === "not_yet_open"
                      ? "Upcoming Casting"
                      : "Applications Closed"}
                  </p>
                  <h1 className="text-2xl md:text-3xl font-bold">{settings.campaignName}</h1>
                </div>
              </div>

              <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {settings.closedReason === "not_yet_open" && formattedOpenDate
                  ? `Applications for ${settings.campaignName} will open on ${formattedOpenDate}. Leave your email below and we will notify you as soon as submissions go live.`
                  : settings.closedMessage ||
                    "Applications for this casting round are currently closed. Leave your email below and we will notify you as soon as the next casting opens."}
              </p>

              <div
                className="pt-6 border-t"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4" style={{ color: "var(--accent-color)" }} />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">
                    Get notified when casting opens
                  </h2>
                </div>

                {alertSubscribed ? (
                  <div
                    className="flex items-center gap-3 p-4 border"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--success-color) 14%, transparent)",
                      borderColor: "color-mix(in srgb, var(--success-color) 40%, transparent)",
                    }}
                  >
                    <Check className="w-5 h-5 flex-shrink-0" style={{ color: "var(--success-color)" }} />
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                      You&apos;re subscribed! We&apos;ll send you an email as soon as the next casting opens.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubscribeAlert} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      required
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className={`${inputBaseClass} flex-1`}
                    />
                    <button
                      type="submit"
                      disabled={isSubscribingAlert}
                      className="btn-primary whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      {isSubscribingAlert && <Loader2 className="w-4 h-4 animate-spin" />}
                      Notify Me
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Step indicator */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  {STEPS.map((step) => {
                    const isCompleted = step.id < currentStep
                    const isCurrent = step.id === currentStep
                    return (
                      <div key={step.id} className="flex flex-col items-center flex-1">
                        <div
                          className="w-10 h-10 flex items-center justify-center text-sm font-bold transition-colors"
                          style={{
                            backgroundColor: isCompleted
                              ? "var(--success-color)"
                              : isCurrent
                                ? "var(--accent-color)"
                                : "var(--surface-bg)",
                            color:
                              isCompleted || isCurrent
                                ? "var(--btn-primary-text)"
                                : "var(--text-muted)",
                            border:
                              !isCompleted && !isCurrent
                                ? "1px solid var(--border-color)"
                                : undefined,
                          }}
                        >
                          {isCompleted ? <Check className="w-5 h-5" /> : step.id}
                        </div>
                        <span
                          className={`text-xs mt-1.5 text-center ${isCurrent ? "font-semibold" : ""}`}
                          style={{
                            color: isCurrent ? "var(--accent-color)" : "var(--text-muted)",
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Progress bar */}
                <div
                  className="w-full h-1 mt-3"
                  style={{ backgroundColor: "var(--surface-bg)" }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
                      backgroundColor: "var(--accent-color)",
                    }}
                  />
                </div>
              </div>

              {/* STEP 1: DNI (Front + Back) */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">ID Verification</h1>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Upload clear photos of both sides of your ID (DNI/Passport). This is required to verify your identity and age.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* DNI Front */}
                    <div
                      className="flex flex-col items-center justify-center border-2 border-dashed p-8 min-h-[250px]"
                      style={{
                        borderColor: "var(--form-input-border)",
                        backgroundColor: "var(--surface-bg)",
                      }}
                    >
                      <Camera className="w-12 h-12 mb-3" style={{ color: "var(--text-muted)" }} />
                      <p className="text-center text-base font-medium mb-1">DNI - Front</p>
                      <p className="text-center text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                        Side with your photo
                      </p>
                      <input
                        id="dniFront"
                        type="file"
                        name="dniFront"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, "dniFront")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById("dniFront")?.click()}
                        className="px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                        style={uploadBtnStyle}
                      >
                        Select File
                      </button>
                      {files.dniFront && (
                        <div className="mt-3 flex items-center gap-2">
                          <Check className="w-4 h-4" style={{ color: "var(--success-color)" }} />
                          <p
                            className="text-xs truncate max-w-[180px]"
                            style={{ color: "var(--success-color)" }}
                          >
                            {files.dniFront.name}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* DNI Back */}
                    <div
                      className="flex flex-col items-center justify-center border-2 border-dashed p-8 min-h-[250px]"
                      style={{
                        borderColor: "var(--form-input-border)",
                        backgroundColor: "var(--surface-bg)",
                      }}
                    >
                      <Camera className="w-12 h-12 mb-3" style={{ color: "var(--text-muted)" }} />
                      <p className="text-center text-base font-medium mb-1">DNI - Back</p>
                      <p className="text-center text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                        Reverse side of your ID
                      </p>
                      <input
                        id="dniBack"
                        type="file"
                        name="dniBack"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, "dniBack")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById("dniBack")?.click()}
                        className="px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                        style={uploadBtnStyle}
                      >
                        Select File
                      </button>
                      {files.dniBack && (
                        <div className="mt-3 flex items-center gap-2">
                          <Check className="w-4 h-4" style={{ color: "var(--success-color)" }} />
                          <p
                            className="text-xs truncate max-w-[180px]"
                            style={{ color: "var(--success-color)" }}
                          >
                            {files.dniBack.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info note about verification */}
                  <div
                    className="flex items-start gap-3 border p-4"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--accent-color) 12%, transparent)",
                      borderColor: "color-mix(in srgb, var(--accent-color) 35%, transparent)",
                    }}
                  >
                    <ShieldCheck
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: "var(--accent-color)" }}
                    />
                    <div>
                      <p className="text-sm font-semibold mb-1" style={{ color: "var(--accent-color)" }}>
                        Identity Verification
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        After uploading your photos in the next step, we will automatically verify that your face matches your ID.
                        Your images are processed securely and are not stored during verification.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Photos & Video */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Photos &amp; Video</h2>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Upload your general photos and a short presentation video. Your first photo will be used for identity verification.
                    </p>
                  </div>

                  {/* General photos */}
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed p-8 min-h-[200px]"
                    style={{
                      borderColor: "var(--form-input-border)",
                      backgroundColor: "var(--surface-bg)",
                    }}
                  >
                    <ImageIcon className="w-12 h-12 mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="text-center text-base font-medium mb-1">General Photos</p>
                    <p className="text-center text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                      The first photo must clearly show your face (used for verification)
                    </p>
                    <input
                      id="generalPhotos"
                      type="file"
                      name="generalPhotos"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileChange(e, "generalPhotos")}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById("generalPhotos")?.click()}
                      className="px-6 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                      style={uploadBtnStyle}
                    >
                      Select Files
                    </button>
                    {files.generalPhotos.length > 0 && (
                      <p className="text-xs mt-2" style={{ color: "var(--success-color)" }}>
                        {files.generalPhotos.length} file(s) selected
                      </p>
                    )}
                  </div>

                  {/* Body reference image */}
                  <div className="flex justify-center">
                    <img
                      src="/images/imagen-corporal.png"
                      alt="Body reference"
                      className="w-[30%] h-auto"
                    />
                  </div>

                  {/* Presentation video */}
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed p-8 min-h-[200px]"
                    style={{
                      borderColor: "var(--form-input-border)",
                      backgroundColor: "var(--surface-bg)",
                    }}
                  >
                    <Video className="w-12 h-12 mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="text-center text-base font-medium mb-4">Presentation Video</p>
                    <input
                      id="presentationVideo"
                      type="file"
                      name="presentationVideo"
                      accept="video/mp4,video/*"
                      onChange={(e) => handleFileChange(e, "presentationVideo")}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById("presentationVideo")?.click()}
                      className="px-6 py-2 text-sm font-medium mb-2 transition-opacity hover:opacity-90"
                      style={uploadBtnStyle}
                    >
                      Select Video
                    </button>
                    <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                      Max 2 min, Format: MP4
                    </p>
                    <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                      We recommend introducing yourself clearly
                    </p>
                    {files.presentationVideo && (
                      <div className="mt-2 flex items-center gap-2">
                        <Check className="w-4 h-4" style={{ color: "var(--success-color)" }} />
                        <p className="text-xs" style={{ color: "var(--success-color)" }}>
                          {files.presentationVideo.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Verification notice */}
                  <div
                    className="flex items-start gap-3 border p-4"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--warning-color) 12%, transparent)",
                      borderColor: "color-mix(in srgb, var(--warning-color) 35%, transparent)",
                    }}
                  >
                    <AlertTriangle
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: "var(--warning-color)" }}
                    />
                    <div>
                      <p className="text-sm font-semibold mb-1" style={{ color: "var(--warning-color)" }}>
                        Automatic Verification
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        When you click &quot;Next&quot;, we will verify that your face matches the ID you uploaded.
                        If verification fails, you will need to upload all files again.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Personal Info */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Personal Information</h2>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Fields marked with * are required.
                    </p>
                  </div>

                  {verificationPassed && (
                    <div
                      className="flex items-center gap-3 border p-4"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--success-color) 12%, transparent)",
                        borderColor: "color-mix(in srgb, var(--success-color) 35%, transparent)",
                      }}
                    >
                      <div
                        className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--success-color) 20%, transparent)",
                        }}
                      >
                        <Check className="w-5 h-5" style={{ color: "var(--success-color)" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--success-color)" }}>
                          Identity Verified
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          Your identity has been successfully verified.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelBaseClass}>Full Name *</label>
                      <input
                        type="text"
                        name="fullName"
                        placeholder="Full Name"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                        style={errors.fullName ? { borderColor: "var(--error-color)" } : undefined}
                      />
                      {errors.fullName && (
                        <p className="text-sm mt-1" style={{ color: "var(--error-color)" }}>
                          {errors.fullName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelBaseClass}>Date of Birth *</label>
                      <input
                        type="date"
                        name="birthDate"
                        value={formData.birthDate}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                        style={errors.birthDate ? { borderColor: "var(--error-color)" } : undefined}
                      />
                      {errors.birthDate && (
                        <p className="text-sm mt-1" style={{ color: "var(--error-color)" }}>
                          {errors.birthDate}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelBaseClass}>Email *</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                        style={errors.email ? { borderColor: "var(--error-color)" } : undefined}
                      />
                      {errors.email && (
                        <p className="text-sm mt-1" style={{ color: "var(--error-color)" }}>
                          {errors.email}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelBaseClass}>Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="Phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Physical Characteristics & Appearance */}
              {currentStep === 4 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Physical Characteristics</h2>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      All fields are optional.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelBaseClass}>Gender</label>
                      <div className="relative">
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className={`${inputBaseClass} appearance-none cursor-pointer pr-10`}
                        >
                          <option value="">Gender</option>
                          <option value="Masculino">Male</option>
                          <option value="Femenino">Female</option>
                          <option value="Otro">Other</option>
                        </select>
                        <ChevronDown
                          className="w-4 h-4 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--form-input-text)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelBaseClass}>Height</label>
                      <div className="relative">
                        <select
                          name="height"
                          value={formData.height}
                          onChange={handleInputChange}
                          className={`${inputBaseClass} appearance-none cursor-pointer pr-10`}
                        >
                          <option value="">Height</option>
                          <option value="150-160">150-160 cm</option>
                          <option value="160-170">160-170 cm</option>
                          <option value="170-180">170-180 cm</option>
                          <option value="180+">180+ cm</option>
                        </select>
                        <ChevronDown
                          className="w-4 h-4 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--form-input-text)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelBaseClass}>Weight</label>
                      <input
                        type="text"
                        name="weight"
                        placeholder="Weight"
                        value={formData.weight}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelBaseClass}>Bust</label>
                      <input
                        type="text"
                        name="bust"
                        placeholder="Bust"
                        value={formData.bust}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                      />
                    </div>
                    <div>
                      <label className={labelBaseClass}>Waist</label>
                      <input
                        type="text"
                        name="waist"
                        placeholder="Waist"
                        value={formData.waist}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                      />
                    </div>
                    <div>
                      <label className={labelBaseClass}>Hips</label>
                      <input
                        type="text"
                        name="hips"
                        placeholder="Hips"
                        value={formData.hips}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                      />
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold">Appearance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelBaseClass}>Hair Color</label>
                      <div className="relative">
                        <select
                          name="hairColor"
                          value={formData.hairColor}
                          onChange={handleInputChange}
                          className={`${inputBaseClass} appearance-none cursor-pointer pr-10`}
                        >
                          <option value="">Hair Color</option>
                          <option value="Negro">Black</option>
                          <option value="Castaño">Brown</option>
                          <option value="Rubio">Blonde</option>
                          <option value="Rojo">Red</option>
                        </select>
                        <ChevronDown
                          className="w-4 h-4 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--form-input-text)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelBaseClass}>Eye Color</label>
                      <div className="relative">
                        <select
                          name="eyeColor"
                          value={formData.eyeColor}
                          onChange={handleInputChange}
                          className={`${inputBaseClass} appearance-none cursor-pointer pr-10`}
                        >
                          <option value="">Eye Color</option>
                          <option value="Negro">Black</option>
                          <option value="Marrón">Brown</option>
                          <option value="Verde">Green</option>
                          <option value="Azul">Blue</option>
                        </select>
                        <ChevronDown
                          className="w-4 h-4 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--form-input-text)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelBaseClass}>Skin Tone</label>
                      <div className="relative">
                        <select
                          name="skinTone"
                          value={formData.skinTone}
                          onChange={handleInputChange}
                          className={`${inputBaseClass} appearance-none cursor-pointer pr-10`}
                        >
                          <option value="">Skin Tone</option>
                          <option value="Claro">Fair</option>
                          <option value="Medio">Medium</option>
                          <option value="Oscuro">Dark</option>
                        </select>
                        <ChevronDown
                          className="w-4 h-4 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--form-input-text)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelBaseClass}>Tattoos</label>
                      <input
                        type="text"
                        name="tattoos"
                        placeholder="Describe tattoos if any"
                        value={formData.tattoos}
                        onChange={handleInputChange}
                        className={inputBaseClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Experience, Additional Info & Social Media */}
              {currentStep === 5 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Final Details</h2>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Experience, additional info, and social media links.
                    </p>
                  </div>

                  <div>
                    <label className={labelBaseClass}>Experience Level</label>
                    <div className="relative">
                      <select
                        name="experience"
                        value={formData.experience}
                        onChange={handleInputChange}
                        className={`${inputBaseClass} appearance-none cursor-pointer pr-10`}
                      >
                        <option value="">No experience</option>
                        <option value="1-2">1-2 years</option>
                        <option value="3-5">3-5 years</option>
                        <option value="5+">More than 5 years</option>
                      </select>
                      <ChevronDown
                        className="w-4 h-4 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--form-input-text)" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelBaseClass}>Additional Information</label>
                    <textarea
                      name="additionalInfo"
                      placeholder="Anything else you'd like us to know..."
                      value={formData.additionalInfo}
                      onChange={handleInputChange}
                      rows={5}
                      className={`${inputBaseClass} resize-none`}
                    />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Social Media</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelBaseClass}>Instagram</label>
                        <input
                          type="url"
                          name="socialMedia"
                          placeholder="Instagram link"
                          value={formData.socialMedia}
                          onChange={handleInputChange}
                          className={inputBaseClass}
                        />
                      </div>
                      <div>
                        <label className={labelBaseClass}>OnlyFans</label>
                        <input
                          type="url"
                          name="socialMedia2"
                          placeholder="OnlyFans link"
                          value={formData.socialMedia2}
                          onChange={handleInputChange}
                          className={inputBaseClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between mt-10">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={isVerifying}
                    className="btn-secondary px-8 disabled:opacity-50"
                  >
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < STEPS.length ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={isVerifying}
                    className="btn-primary px-8 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4" />
                        Verifying...
                      </>
                    ) : (
                      "Next"
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploading}
                    className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting || isUploading ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        {isUploading ? "Uploading files..." : "Submitting..."}
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
