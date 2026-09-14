'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProjectAction, deleteProjectAction } from '@/lib/actions/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

interface Props {
  project: {
    id: string
    name: string
    slug: string
    description: string | null
    registryUrl: string | null
    createdAt: string
  }
}

export function ProjectSettingsForm({ project }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, startDelete] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      await updateProjectAction(project.id, formData)
    } catch {
      setError('Failed to update project.')
      setLoading(false)
    }
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteProjectAction(project.id)
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>}
            {success && <div className="rounded-md bg-brand-50 p-3 text-sm text-brand-700">Settings updated.</div>}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={project.name} required />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={project.slug} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={project.description ?? ''} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registryUrl">Registry URL</Label>
              <Input id="registryUrl" name="registryUrl" defaultValue={project.registryUrl ?? ''} />
            </div>
            <div className="text-xs text-ink-muted">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </div>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
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
          <AlertDialog>
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
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-danger-500 text-white hover:bg-danger-500/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
