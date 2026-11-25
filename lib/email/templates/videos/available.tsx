import * as React from "react"
import { Section, Text, Img } from "@react-email/components"
import { BaseEmail, EmailButton, EmailHeading, EmailText, EmailInfoBox } from "../base"

interface VideoAvailableProps {
  subscriberName?: string | null
  videoTitle: string
  videoSlug: string
  performerNames?: string | null
  categoryName?: string | null
  thumbnailUrl?: string | null
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bukkakery.com"

export function VideoAvailableTemplate({
  subscriberName,
  videoTitle,
  videoSlug,
  performerNames,
  categoryName,
  thumbnailUrl,
}: VideoAvailableProps) {
  const videoUrl = `${APP_URL}/videos/${videoSlug}`
  const greeting = subscriberName?.trim() ? `Hi ${subscriberName.trim()},` : "Hi there,"
  const headline = performerNames?.trim() ? `${performerNames} — ${videoTitle}` : videoTitle

  return (
    <BaseEmail preview={`NEW SCENE: ${headline} is now live on BUKKAKERY`}>
      <EmailHeading>New Scene Available Now!</EmailHeading>

      <EmailText>{greeting}</EmailText>

      <EmailText>
        The wait is over —{" "}
        <strong>{headline}</strong>
        {categoryName ? ` (${categoryName})` : ""} is now live and ready to watch on BUKKAKERY.
      </EmailText>

      {thumbnailUrl && (
        <Section style={imageWrapper}>
          <Img
            src={thumbnailUrl.startsWith("http") ? thumbnailUrl : `${APP_URL}${thumbnailUrl}`}
            alt={videoTitle}
            width="480"
            style={previewImage}
          />
        </Section>
      )}

      <EmailInfoBox variant="success">
        <Text style={infoText}>
          You asked us to notify you when <strong>{videoTitle}</strong> dropped. Jump straight into the full scene now.
        </Text>
      </EmailInfoBox>

      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <EmailButton href={videoUrl}>Watch Now</EmailButton>
      </div>

      <EmailText style={{ fontSize: "14px", color: "#6b7280" }}>
        Thank you for being part of BUKKAKERY.
      </EmailText>
    </BaseEmail>
  )
}

const imageWrapper = {
  textAlign: "center" as const,
  margin: "24px 0",
}

const previewImage = {
  margin: "0 auto",
  borderRadius: "4px",
  objectFit: "cover" as const,
  maxWidth: "100%",
}

const infoText = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
}
