// Auth templates
export { VerifyEmailTemplate } from "./auth/verify-email"
export { WelcomeEmailTemplate } from "./auth/welcome"
export { ResetPasswordEmailTemplate } from "./auth/reset-password"
export { PasswordChangedEmailTemplate } from "./auth/password-changed"

// Order templates
export { OrderConfirmationTemplate } from "./orders/confirmation"
export { PaymentReceivedTemplate } from "./orders/payment-received"
export { OrderProcessingTemplate } from "./orders/processing"
export { OrderShippedTemplate } from "./orders/shipped"
export { OrderDeliveredTemplate } from "./orders/delivered"
export { OrderCancelledTemplate } from "./orders/cancelled"
export { PaymentFailedTemplate } from "./orders/payment-failed"

// Subscription templates
export { SubscriptionActivatedTemplate } from "./subscriptions/activated"
export { RenewalReminderTemplate } from "./subscriptions/renewal-reminder"
export { SubscriptionRenewedTemplate } from "./subscriptions/renewed"
export { SubscriptionCancelledTemplate } from "./subscriptions/cancelled"
export { SubscriptionExpiredTemplate } from "./subscriptions/expired"
export { SubscriptionUpgradeTemplate } from "./subscriptions/upgrade"
export { SubscriptionDowngradeTemplate } from "./subscriptions/downgrade"
export { SubscriptionPaymentFailedTemplate } from "./subscriptions/payment-failed"

// Casting templates
export { CastingReceivedTemplate } from "./casting/received"
export { CastingReviewingTemplate } from "./casting/reviewing"
export { CastingAcceptedTemplate } from "./casting/accepted"
export { CastingRejectedTemplate } from "./casting/rejected"
export { CastingCampaignOpenedTemplate } from "./casting/campaign-opened"
export { CastingCampaignClosedTemplate } from "./casting/campaign-closed"

// Performer templates
export { PerformerAvailableTemplate } from "./performers/available"

// Video templates
export { VideoAvailableTemplate } from "./videos/available"

// Base components
export { BaseEmail, EmailButton, EmailHeading, EmailText, EmailInfoBox } from "./base"
