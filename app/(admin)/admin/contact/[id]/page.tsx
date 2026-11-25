import { redirect } from "next/navigation"

export default async function ContactMessageRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/contact?id=${encodeURIComponent(id)}`)
}
