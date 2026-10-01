'use client'

import { useState } from 'react'
import { unstable_rethrow, useRouter } from 'next/navigation'
import { updateProjectAction, deleteProjectAction } from '@/lib/actions/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/format'

interface Props {
  project: {
    id: string
    name: string
    description: string | null
    createdAt: string
  }
}

export function ProjectSettingsForm({ project }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useFeedback()

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
        router.refresh()
      } else setError('Project settings could not be saved. Please try again.')
    } catch (err) {
      unstable_rethrow(err)
      setError('Project settings could not be saved. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-base">Project details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={project.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={project.description ?? ''} rows={3} />
            </div>
            <div className="text-xs text-ink-muted">
              Created {formatDate(project.createdAt)}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="primary" type="submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Separator />

      <Card className="border-danger-200">
        <CardHeader>
          <CardTitle className="text-base text-danger-500">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-ink-muted">
            Deleting a project removes all services, environments, deployments, and configurations permanently.
          </p>
          <AlertDialog open={deleteOpen} onOpenChange={(nextOpen) => {
            if (!deleting) {
              setDeleteOpen(nextOpen)
              if (nextOpen) setDeleteError(null)
            }
          }}>
            <AlertDialogTrigger asChild>
              <Button variant="danger" size="sm" disabled={deleting}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All services, environments, and deployment history will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError ? <InlineNotice tone="error">{deleteError}</InlineNotice> : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting} aria-busy={deleting}>
                  {deleting ? 'Deleting…' : 'Delete project'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
