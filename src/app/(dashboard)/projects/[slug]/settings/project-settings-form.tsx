'use client'

import { useRef, useState } from 'react'
import { unstable_rethrow, useRouter } from 'next/navigation'
import { updateProjectAction, deleteProjectAction } from '@/lib/actions/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import { Time } from '@/components/time'

interface Props {
  project: {
    id: string
    name: string
    slug: string
    description: string | null
    createdAt: string
  }
  counts: { services: number; routes: number; volumes: number }
}

export function ProjectSettingsForm({ project }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const router = useRouter()
  const { toast } = useFeedback()
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    setLoading(true)
    try {
      const result = await updateProjectAction(project.id, formData)
      if (result?.error) setError(result.error)
      else if (result?.success) {
        toast({ tone: 'success', title: 'Project settings saved.' })
        setDirty(false)
        router.refresh()
      } else setError('Project settings could not be saved. Please try again.')
    } catch (err) {
      unstable_rethrow(err)
      setError('Project settings could not be saved. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <form ref={formRef} onSubmit={handleSubmit} onChange={() => setDirty(true)}>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <div className="max-w-xl space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={project.name} required />
            </div>
            <div className="max-w-[720px] space-y-2">
              <Label htmlFor="description" optional>Description</Label>
              <Textarea id="description" name="description" defaultValue={project.description ?? ''} rows={3} />
            </div>
            <div className="max-w-xl space-y-2">
              <Label htmlFor="project-slug">Slug</Label>
              <Input id="project-slug" name="slug" value={project.slug} readOnly mono className="bg-sunken" aria-describedby="project-slug-help" />
              <p id="project-slug-help" className="text-xs text-ink-muted">Set when the project was created.</p>
            </div>
            <div className="text-xs text-ink-muted">
              Created <Time value={project.createdAt} mode="absolute" />
            </div>
          </CardContent>
        </form>
      </Card>
      <UnsavedChangesBar dirty={dirty} pending={loading} onSave={() => formRef.current?.requestSubmit()} onDiscard={() => { formRef.current?.reset(); setDirty(false); setError(null) }} />

    </div>
  )
}

export function ProjectDangerZone({ project, counts }: Props) {
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState('')

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDeleteError(null)
    setDeleting(true)
    try {
      const result = await deleteProjectAction(project.id)
      if (result?.error) setDeleteError(result.error)
    } catch (err) {
      unstable_rethrow(err)
      setDeleteError('The project could not be deleted. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return <Card className="border-danger-200">
        <CardHeader>
          <CardTitle className="text-danger-500">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-ink-muted">
            Deleting a project removes all services, environments, deployments, and configurations permanently.
          </p>
          <AlertDialog open={deleteOpen} onOpenChange={(nextOpen) => {
            if (!deleting) {
              setDeleteOpen(nextOpen)
              setConfirmation('')
              if (nextOpen) setDeleteError(null)
            }
          }}>
            <AlertDialogTrigger asChild>
              <Button variant="danger" size="sm" disabled={deleting}>
                <Trash2 />
                Delete project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                <AlertDialogDescription>Deletes {counts.services} {counts.services === 1 ? 'service' : 'services'}, {counts.routes} {counts.routes === 1 ? 'route' : 'routes'}, {counts.volumes} {counts.volumes === 1 ? 'volume' : 'volumes'}, all secrets and deployment history. This can’t be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 px-5 py-4">
                <Label htmlFor="confirm-project-name">Type <span className="font-mono font-semibold text-ink">{project.slug}</span> to confirm</Label>
                <Input id="confirm-project-name" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              </div>
              {deleteError ? <InlineNotice tone="error">{deleteError}</InlineNotice> : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting || confirmation !== project.slug} aria-busy={deleting}>
                  {deleting ? 'Deleting…' : 'Delete project'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
}
