'use client'

import { useState, useMemo, useTransition } from 'react'
import { addOrganizationMemberAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AddMemberDialog({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('member')
  const [email, setEmail] = useState('')

  if (!canManage) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('role', selectedRole)
    startTransition(async () => {
      try {
        await addOrganizationMemberAction(formData)
        handleClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add member.')
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setError(null)
    setSelectedRole('member')
    setEmail('')
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add organization member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-member-email">Email</Label>
              <Input
                id="add-member-email"
                name="email"
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-member-role">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="add-member-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error ? <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div> : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" size="sm" disabled={pending}>
              {pending ? 'Adding...' : 'Add member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
