import { redirect } from 'next/navigation'
export default async function ClusterSettingsPage() {
  redirect('/settings/organization#connection')
}
