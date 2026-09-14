import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { serviceConfigs } from './schema'

export const serviceAdvancedSettings = pgTable(
  'service_advanced_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceConfigId: uuid('service_config_id')
      .notNull()
      .references(() => serviceConfigs.id, { onDelete: 'cascade' }),
    runtime: text('runtime').notNull().default('runc'),
    apiAccessScope: text('api_access_scope'),
    apiAccessLevel: text('api_access_level'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('service_advanced_settings_config_idx').on(table.serviceConfigId),
  ],
)
