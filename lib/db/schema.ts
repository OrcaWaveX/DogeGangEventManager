import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
export const gameNights = pgTable('game_nights', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('userId').notNull(), title: text('title').notNull(), description: text('description').notNull().default(''), game: text('game'), bannerUrl: text('banner_url'), startsAt: timestamp('starts_at', { withTimezone: true }), status: text('status').notNull().default('draft'), schedulingOpen: boolean('scheduling_open').notNull().default(false), gameVotingOpen: boolean('game_voting_open').notNull().default(false), capacity: integer('capacity'), discordUrl: text('discord_url'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const discordLinks = pgTable('discord_links', {
  userId: text('user_id').primaryKey(),
  discordId: text('discord_id').notNull().unique(),
  username: text('username').notNull(),
  globalName: text('global_name'),
  avatar: text('avatar'),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
})
