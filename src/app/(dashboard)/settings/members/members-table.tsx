'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MemberRoleSelect } from './member-role-select'
import { MemberActionsMenu } from '../instance/instance-admin-actions'
import { instanceRoleLabels, organizationRoleLabels } from '@/lib/labels'

interface TeamRef {
  id: string
  name: string
}

interface MemberRow {
  membershipId: string
  userId: string
  name: string
  email: string
  avatar: string | null
  role: 'owner' | 'admin' | 'member'
  isInstanceAdmin: boolean
  teams: TeamRef[]
}

interface TeamOption {
  id: string
  name: string
}

interface MembersTableProps {
  members: MemberRow[]
  teams: TeamOption[]
  canManageRoles: boolean
  canRemoveMembers: boolean
  showInstanceAdmin: boolean
  currentUserId: string
}

export function MembersTable({
  members,
  teams,
  canManageRoles,
  canRemoveMembers,
  showInstanceAdmin,
  currentUserId,
}: MembersTableProps) {
  const [search, setSearch] = useState('')
  const [instanceRoleFilter, setInstanceRoleFilter] = useState('all')
  const [orgRoleFilter, setOrgRoleFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')

  const filtered = useMemo(() => {
    let result = members

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((member) =>
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q),
      )
    }

    if (showInstanceAdmin && instanceRoleFilter !== 'all') {
      result = result.filter((member) =>
        instanceRoleFilter === 'admin' ? member.isInstanceAdmin : !member.isInstanceAdmin,
      )
    }

    if (orgRoleFilter !== 'all') {
      result = result.filter((member) => member.role === orgRoleFilter)
    }

    if (teamFilter !== 'all') {
      result = result.filter((member) => member.teams.some((team) => team.id === teamFilter))
    }

    return result
  }, [
    members,
    search,
    showInstanceAdmin,
    instanceRoleFilter,
    orgRoleFilter,
    teamFilter,
  ])

  const uniqueMemberCount = useMemo(
    () => new Set(members.map((member) => member.userId)).size,
    [members],
  )
  const columnCount = 5 + (showInstanceAdmin ? 1 : 0)
  const showFilters = members.length > 10

  return (
    <Card>
      <CardHeader className="min-h-0 flex-col items-stretch gap-3 py-3 xl:flex-row xl:items-center">
        <div className="shrink-0">
          <CardTitle>Members</CardTitle>
          <p className="mt-0.5 text-xs text-ink-muted">
            {uniqueMemberCount} {uniqueMemberCount === 1 ? 'member' : 'members'}
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          <div className="min-w-[190px] flex-1 sm:max-w-[240px]">
            <SearchInput
              placeholder="Search members..."
              aria-label="Search members"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {showFilters ? <div className="flex flex-wrap items-center gap-0.5">
            {showInstanceAdmin ? (
              <Select value={instanceRoleFilter} onValueChange={setInstanceRoleFilter}>
                <SelectTrigger className="w-auto min-w-[164px]" aria-label="Filter by instance role" title="Filter by instance role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All instance roles</SelectItem>
                  <SelectItem value="admin">{instanceRoleLabels.admin}</SelectItem>
                  <SelectItem value="user">{instanceRoleLabels.user}</SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            <Select value={orgRoleFilter} onValueChange={setOrgRoleFilter}>
              <SelectTrigger className="w-auto min-w-[190px]" aria-label="Filter by organization role" title="Filter by organization role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {showInstanceAdmin ? 'All organization roles' : 'All roles'}
                </SelectItem>
                <SelectItem value="owner">{organizationRoleLabels.owner}</SelectItem>
                <SelectItem value="admin">{organizationRoleLabels.admin}</SelectItem>
                <SelectItem value="member">{organizationRoleLabels.member}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={teamFilter} onValueChange={setTeamFilter} disabled={teams.length === 0}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by team">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> : null}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              {showInstanceAdmin ? <TableHead>Instance Role</TableHead> : null}
              <TableHead>{showInstanceAdmin ? 'Organization Role' : 'Role'}</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="w-[52px]"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-8 text-center text-sm text-ink-muted">
                  No members match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => (
                <TableRow key={member.membershipId ?? `user-${member.userId}`}>
                  <TableCell>
                    <Link href={`/settings/members/${member.userId}`} className="group flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 rounded-md">
                        {member.avatar ? <AvatarImage src={member.avatar} /> : null}
                        <AvatarFallback className="bg-brand-50 text-brand-700">
                          {member.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-ink transition-colors group-hover:text-brand-700">{member.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-ink-muted">{member.email}</TableCell>

                  {showInstanceAdmin ? (
                    <TableCell className="text-sm text-ink-soft">
                      {instanceRoleLabels[member.isInstanceAdmin ? 'admin' : 'user']}
                    </TableCell>
                  ) : null}

                  <TableCell>
                    {canManageRoles ? <MemberRoleSelect membershipId={member.membershipId} role={member.role} canManage disabledReason={member.role === 'owner' ? 'The organization owner role cannot be changed here.' : undefined} /> : organizationRoleLabels[member.role]}
                  </TableCell>

                  <TableCell>
                    {member.teams.length > 0 ? (
                      <span className="text-sm text-ink-soft">{member.teams.map((team) => team.name).join(', ')}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <MemberActionsMenu
                      membershipId={member.membershipId}
                      memberName={member.name}
                      email={member.email}
                      canRemoveInstanceAdmin={showInstanceAdmin && member.isInstanceAdmin && member.userId !== currentUserId}
                      canRemoveFromOrganization={canRemoveMembers && member.userId !== currentUserId}
                    />
                  </TableCell>

                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
