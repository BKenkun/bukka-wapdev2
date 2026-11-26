import * as React from "react"
import { Section, Text } from "@react-email/components"
import { BaseEmail, EmailButton, EmailHeading, EmailText, EmailInfoBox } from "../base"

interface CastingCampaignClosedProps {
  campaignName: string
  auditionsText?: string
  resultsText?: string
  customMessage?: string
  logoUrl?: string | null
  primaryColor?: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bukkakery.com"

export function CastingCampaignClosedTemplate({
  campaignName,
  auditionsText,
  resultsText,
  customMessage,
  logoUrl,
  primaryColor = "#FA4860",
}: CastingCampaignClosedProps) {
  const hasUpcomingDates = Boolean(auditionsText || resultsText)

  return (
    <BaseEmail
      preview={`Applications closed for ${campaignName}`}
      logoUrl={logoUrl}
      primaryColor={primaryColor}
    >
      <EmailHeading>Casting Applications Closed</EmailHeading>

      <EmailText>
        Applications for <strong>{campaignName}</strong> on BUKKAKERY are now closed.
      </EmailText>

      <EmailInfoBox variant="warning">
        <EmailText style={{ margin: 0, fontSize: "14px" }}>
          {customMessage?.trim() ||
            "Thank you to everyone who applied! Our team is now reviewing all received applications."}
        </EmailText>
      </EmailInfoBox>

      {hasUpcomingDates && (
        <Section style={datesBox}>
          <Text style={datesTitle}>Upcoming Schedule</Text>
          {auditionsText && (
            <Text style={dateItem}>
              <strong>Auditions:</strong> {auditionsText}
            </Text>
          )}
          {resultsText && (
            <Text style={dateItem}>
              <strong>Results:</strong> {resultsText}
            </Text>
          )}
        </Section>
      )}

      <EmailText>
        If you submitted an application, we will keep you updated by email as your review progresses.
        Missed this round? Stay subscribed and we will let you know as soon as the next casting opens.
      </EmailText>

      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <EmailButton href={`${APP_URL}/casting`} primaryColor={primaryColor}>
          Visit Casting Page
        </EmailButton>
      </div>

      <EmailText style={{ fontSize: "14px", color: "#6b7280" }}>
        Thank you for your interest in BUKKAKERY.
      </EmailText>
    </BaseEmail>
  )
}

const datesBox = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "24px",
  margin: "24px 0",
}

const datesTitle = {
  color: "#111827",
  fontSize: "16px",
  fontWeight: "700",
  margin: "0 0 14px",
}

const dateItem = {
  color: "#374151",
  fontSize: "14px",
  margin: "0 0 8px",
}
