import * as React from "react"
import { Section, Text } from "@react-email/components"
import { BaseEmail, EmailButton, EmailHeading, EmailText, EmailInfoBox } from "../base"

interface CastingCampaignOpenedProps {
  campaignName: string
  applicationsCloseText?: string
  auditionsText?: string
  resultsText?: string
  customMessage?: string
  logoUrl?: string | null
  primaryColor?: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bukkakery.com"

export function CastingCampaignOpenedTemplate({
  campaignName,
  applicationsCloseText,
  auditionsText,
  resultsText,
  customMessage,
  logoUrl,
  primaryColor = "#FA4860",
}: CastingCampaignOpenedProps) {
  const hasDates = Boolean(applicationsCloseText || auditionsText || resultsText)

  return (
    <BaseEmail
      preview={`Casting applications are now open — ${campaignName}`}
      logoUrl={logoUrl}
      primaryColor={primaryColor}
    >
      <EmailHeading>Casting Applications Are Now Open!</EmailHeading>

      <EmailText>
        Great news — applications for <strong>{campaignName}</strong> on BUKKAKERY are officially open.
      </EmailText>

      {customMessage?.trim() && (
        <EmailInfoBox variant="info">
          <EmailText style={{ margin: 0, fontSize: "14px" }}>
            {customMessage.trim()}
          </EmailText>
        </EmailInfoBox>
      )}

      {hasDates && (
        <Section style={datesBox}>
          <Text style={datesTitle}>Important Dates</Text>
          {applicationsCloseText && (
            <Text style={dateItem}>
              <strong>Applications close:</strong> {applicationsCloseText}
            </Text>
          )}
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
        Submit your application online before the deadline to be considered by our casting team.
      </EmailText>

      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <EmailButton href={`${APP_URL}/casting`} primaryColor={primaryColor}>
          Apply Now
        </EmailButton>
      </div>

      <EmailText style={{ fontSize: "14px", color: "#6b7280" }}>
        If you have any questions about the casting process, simply reply to this email or visit our contact page.
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
