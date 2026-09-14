'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MemberRoleSelect } from './member-role-select'
import { RemoveInstanceAdminButton } from '../instance/instance-admin-actions'
import { SearchIcon } from 'lucide-react'

interface MemberRow {
  membershipId: string
  userId: string
  name: string
  email: string
  avatar: string | null
  role: 'owner' | 'admin' | 'member'
  isInstanceAdmin: boolean
  teams: string[]
}

interface MembersTableProps {
  members: MemberRow[]
  teamNames: string[]
  canManageRoles: boolean
  showInstanceAdmin: boolean
  currentUserId: string
}

export function MembersTable({ members, teamNames, canManageRoles, showInstanceAdmin, currentUserId }: MembersTableProps) {
  const [teamFilter, setTeamFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = members
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    }
    if (teamFilter) {
      result = result.filter((m) => m.teams.includes(teamFilter))
    }
    if (roleFilter === 'instance_admin') {
      result = result.filter((m) => m.isInstanceAdmin)
    } else if (roleFilter) {
      result = result.filter((m) => m.role === roleFilter)
    }
    return result
  }, [members, search, teamFilter, roleFilter])

  const selectClass = 'h-9 rounded-lg border border-line bg-surface px-3 pr-8 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 appearance-none'

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Organization members</CardTitle>
          <p className="mt-0.5 text-xs text-ink-muted">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
        </div>
      </CardHeader>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 pb-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            className="h-9 w-56 rounded-lg border border-line bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-faint shadow-card transition-[border-color,box-shadow] duration-150 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {teamNames.length > 0 && (
          <select
            className={selectClass}
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            aria-label="Filter by team"
          >
            <option value="">All teams</option>
            {teamNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
        <select
          className={selectClass}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          {showInstanceAdmin && <option value="instance_admin">Instance admin</option>}
        </select>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Organization role</TableHead>
              {showInstanceAdmin && <TableHead>Instance</TableHead>}
              <TableHead>Teams</TableHead>
              {canManageRoles ? <TableHead className="w-[136px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showInstanceAdmin ? 6 : 5} className="py-8 text-center text-[13px] text-ink-muted">
                  No members match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => (
                <TableRow key={member.membershipId}>
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
                  <TableCell>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                      {member.role}
                    </Badge>
                  </TableCell>
                  {showInstanceAdmin && (
                    <TableCell>
                      {member.isInstanceAdmin ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Admin</Badge>
                          <RemoveInstanceAdminButton email={member.email} adminId={member.userId} currentUserId={currentUserId} />
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {member.teams.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {member.teams.map((name) => (
                          <Badge key={name} variant="secondary">{name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                  {canManageRoles ? (
                    <TableCell>
                      <MemberRoleSelect
                        membershipId={member.membershipId}
                        role={member.role}
                        canManage={canManageRoles}
                      />
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
