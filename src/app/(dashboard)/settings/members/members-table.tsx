'use client'

import { useMemo, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MemberRoleSelect } from './member-role-select'
import { RemoveInstanceAdminButton } from '../instance/instance-admin-actions'

interface TeamRef {
  id: string
  name: string
}

interface MemberRow {
  membershipId: string | null
  userId: string
  name: string
  email: string
  avatar: string | null
  role: 'owner' | 'admin' | 'member' | null
  isInstanceAdmin: boolean
  organizationId: string | null
  organizationName: string | null
  teams: TeamRef[]
}

interface TeamOption {
  id: string
  name: string
  organizationId: string
  organizationName: string
}

interface OrganizationOption {
  id: string
  name: string
}

interface MembersTableProps {
  members: MemberRow[]
  teams: TeamOption[]
  organizations: OrganizationOption[]
  canManageRoles: boolean
  showInstanceAdmin: boolean
  currentUserId: string
}

export function MembersTable({
  members,
  teams,
  organizations,
  canManageRoles,
  showInstanceAdmin,
  currentUserId,
}: MembersTableProps) {
  const [search, setSearch] = useState('')
  const [instanceRoleFilter, setInstanceRoleFilter] = useState('all')
  const [organizationFilter, setOrganizationFilter] = useState('all')
  const [orgRoleFilter, setOrgRoleFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')

  const availableTeams = useMemo(() => {
    if (!showInstanceAdmin || organizationFilter === 'all') return teams
    if (organizationFilter === 'none') return []
    return teams.filter((team) => team.organizationId === organizationFilter)
  }, [teams, showInstanceAdmin, organizationFilter])

  const filtered = useMemo(() => {
    let result = members

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((member) =>
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        member.organizationName?.toLowerCase().includes(q),
      )
    }

    if (showInstanceAdmin && instanceRoleFilter !== 'all') {
      result = result.filter((member) =>
        instanceRoleFilter === 'admin' ? member.isInstanceAdmin : !member.isInstanceAdmin,
      )
    }

    if (showInstanceAdmin && organizationFilter !== 'all') {
      result = result.filter((member) =>
        organizationFilter === 'none'
          ? member.organizationId === null
          : member.organizationId === organizationFilter,
      )
    }

    if (orgRoleFilter !== 'all') {
      result = result.filter((member) =>
        orgRoleFilter === 'none' ? member.role === null : member.role === orgRoleFilter,
      )
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
    organizationFilter,
    orgRoleFilter,
    teamFilter,
  ])

  const uniqueMemberCount = useMemo(
    () => new Set(members.map((member) => member.userId)).size,
    [members],
  )
  const columnCount = 4 + (showInstanceAdmin ? 2 : 0) + (canManageRoles ? 1 : 0)

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
          <div className="relative min-w-[190px] flex-1 sm:max-w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              className="pl-8"
              placeholder="Search members..."
              aria-label="Search members"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {showInstanceAdmin ? (
            <Select value={instanceRoleFilter} onValueChange={setInstanceRoleFilter}>
              <SelectTrigger className="w-[164px]" aria-label="Filter by instance role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instance roles</SelectItem>
                <SelectItem value="admin">Instance admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          ) : null}

          {showInstanceAdmin ? (
            <Select
              value={organizationFilter}
              onValueChange={(value) => {
                setOrganizationFilter(value)
                setTeamFilter('all')
              }}
            >
              <SelectTrigger className="w-[178px]" aria-label="Filter by organization">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                <SelectItem value="none">No organization</SelectItem>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select value={orgRoleFilter} onValueChange={setOrgRoleFilter}>
            <SelectTrigger className="w-[172px]" aria-label="Filter by organization role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {showInstanceAdmin ? 'All organization roles' : 'All roles'}
              </SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              {showInstanceAdmin ? <SelectItem value="none">No organization role</SelectItem> : null}
            </SelectContent>
          </Select>

          <Select value={teamFilter} onValueChange={setTeamFilter} disabled={availableTeams.length === 0}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by team">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {availableTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {showInstanceAdmin && organizationFilter === 'all'
                    ? `${team.name} · ${team.organizationName}`
                    : team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              {showInstanceAdmin ? <TableHead>Instance Role</TableHead> : null}
              {showInstanceAdmin ? <TableHead>Organization</TableHead> : null}
              <TableHead>{showInstanceAdmin ? 'Organization Role' : 'Role'}</TableHead>
              <TableHead>Teams</TableHead>
              {canManageRoles ? <TableHead className="w-[136px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-8 text-center text-[13px] text-ink-muted">
                  No members match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => (
                <TableRow key={member.membershipId ?? `user-${member.userId}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 rounded-md">
                        {member.avatar ? <AvatarImage src={member.avatar} /> : null}
                        <AvatarFallback className="rounded-md bg-ink text-2xs font-semibold text-white">
                          {member.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[13px] font-medium text-ink">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-ink-muted">{member.email}</TableCell>

                  {showInstanceAdmin ? (
                    <TableCell>
                      {member.isInstanceAdmin ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Admin</Badge>
                          <RemoveInstanceAdminButton
                            email={member.email}
                            adminId={member.userId}
                            currentUserId={currentUserId}
                          />
                        </div>
                      ) : (
                        <Badge variant="secondary">User</Badge>
                      )}
                    </TableCell>
                  ) : null}

                  {showInstanceAdmin ? (
                    <TableCell className="text-ink-muted">
                      {member.organizationName ?? '—'}
                    </TableCell>
                  ) : null}

                  <TableCell>
                    {member.role ? (
                      <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                        {member.role}
                      </Badge>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {member.teams.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {member.teams.map((team) => (
                          <Badge key={team.id} variant="secondary">{team.name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>

                  {canManageRoles ? (
                    <TableCell>
                      {member.membershipId && member.role ? (
                        <MemberRoleSelect
                          membershipId={member.membershipId}
                          role={member.role}
                          canManage={canManageRoles}
                        />
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
