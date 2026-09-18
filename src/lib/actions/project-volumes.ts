'use server'

import { posix } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { environments, projectVolumes, serviceConfigs } from '@/db/schema'
import { recordAudit, requireProject, text } from '@/lib/actions/shared'

function validateHostPath(path: string) {
  if (path.startsWith('@/')) {
    const relative = path.slice(2)
    if (!relative || posix.isAbsolute(relative) || posix.normalize(relative) !== relative || relative === '..' || relative.startsWith('../')) {
      throw new Error('Managed paths must contain a clean relative path below @/.')
    }
    return
  }
  if (!posix.isAbsolute(path) || posix.normalize(path) !== path) throw new Error('Host paths must be clean absolute paths.')
}

export async function upsertProjectVolumeAction(projectId: string, environmentId: string, formData: FormData) {
  const access = await requireProject(projectId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [environment] = await db.select({ id: environments.id }).from(environments).where(and(
    eq(environments.id, environmentId),
    eq(environments.projectId, projectId),
  )).limit(1)
  if (!environment) throw new Error('Environment not found.')

  const name = text(formData, 'name')
  const hostPath = text(formData, 'hostPath')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(name)) throw new Error('Volume names must be valid Trellis identifiers.')
  validateHostPath(hostPath)
  await db.insert(projectVolumes).values({ projectId, environmentId, name, hostPath }).onConflictDoUpdate({
    target: [projectVolumes.environmentId, projectVolumes.name],
    set: { hostPath, updatedAt: new Date() },
  })
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'project.volume.saved', resourceType: 'project', resourceId: projectId, details: { environmentId, name, hostPath } })
  revalidatePath(`/projects/${access.project.slug}/volumes`)
}

export async function deleteProjectVolumeAction(projectId: string, environmentId: string, volumeId: string) {
  const access = await requireProject(projectId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [volume] = await db.select().from(projectVolumes).where(and(
    eq(projectVolumes.id, volumeId),
    eq(projectVolumes.projectId, projectId),
    eq(projectVolumes.environmentId, environmentId),
  )).limit(1)
  if (!volume) return
  const configs = await db.select({ volumes: serviceConfigs.volumes }).from(serviceConfigs).where(eq(serviceConfigs.environmentId, environmentId))
  if (configs.some((config) => Array.isArray(config.volumes) && config.volumes.some((entry) => entry && typeof entry === 'object' && (entry as { name?: string }).name === volume.name))) {
    throw new Error(`Volume ${volume.name} is attached to a service. Remove its mounts first.`)
  }
  await db.delete(projectVolumes).where(eq(projectVolumes.id, volumeId))
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'project.volume.deleted', resourceType: 'project', resourceId: projectId, details: { environmentId, name: volume.name } })
  revalidatePath(`/projects/${access.project.slug}/volumes`)
}
