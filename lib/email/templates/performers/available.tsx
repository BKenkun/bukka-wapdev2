import * as React from "react"
import { Section, Text, Img } from "@react-email/components"
import { BaseEmail, EmailButton, EmailHeading, EmailText, EmailInfoBox } from "../base"

interface PerformerAvailableProps {
  subscriberName?: string | null
  performerName: string
  performerSlug: string
  profileImage?: string | null
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bukkakery.com"

export function PerformerAvailableTemplate({
  subscriberName,
  performerName,
  performerSlug,
  profileImage,
}: PerformerAvailableProps) {
  const profileUrl = `${APP_URL}/performers/${performerSlug}`
  const greeting = subscriberName?.trim() ? `Hi ${subscriberName.trim()},` : "Hi there,"

  return (
    <BaseEmail preview={`${performerName} is now available on BUKKAKERY`}>
      <EmailHeading>{performerName} is now available!</EmailHeading>

      <EmailText>{greeting}</EmailText>

      <EmailText>
        The countdown is over — <strong>{performerName}</strong> has officially
        debuted and their profile is now unlocked on BUKKAKERY.
      </EmailText>

      {profileImage && (
        <Section style={imageWrapper}>
          <Img
            src={profileImage.startsWith("http") ? profileImage : `${APP_URL}${profileImage}`}
            alt={performerName}
            width="220"
            style={portraitImage}
          />
        </Section>
      )}

      <EmailInfoBox variant="success">
        <Text style={infoText}>
          You asked us to notify you as soon as <strong>{performerName}</strong>{" "}
          became available. Explore their profile, photos, and latest releases now.
        </Text>
      </EmailInfoBox>

      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <EmailButton href={profileUrl}>
          View {performerName}&apos;s Profile
        </EmailButton>
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

const portraitImage = {
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
