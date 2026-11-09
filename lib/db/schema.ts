import { pgTable, uuid, text, timestamp, boolean, integer, primaryKey } from 'drizzle-orm/pg-core'

export const gameNights = pgTable('game_nights', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  game: text('game'),
  bannerUrl: text('banner_url'),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  schedulingOpen: boolean('scheduling_open').notNull().default(false),
  gameVotingOpen: boolean('game_voting_open').notNull().default(false),
  capacity: integer('capacity'),
  discordUrl: text('discord_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const steamLinks = pgTable('steam_links', {
  userId: text('userId').primaryKey(),
  steamId: text('steam_id').notNull().unique(),
  personaName: text('persona_name'),
  avatarUrl: text('avatar_url'),
  profileUrl: text('profile_url'),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
})

export const memberRoles = pgTable('member_roles', {
  userId: text('user_id').primaryKey(),
  role: text('role').notNull().default('admin'),
  grantedBy: text('granted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dateOptions = pgTable('date_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameNightId: uuid('game_night_id').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dateVotes = pgTable(
  'date_votes',
  {
    dateOptionId: uuid('date_option_id').notNull(),
    userId: text('user_id').notNull(),
    response: text('response').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dateOptionId, t.userId] })],
)

export const gameOptions = pgTable('game_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameNightId: uuid('game_night_id').notNull(),
  name: text('name').notNull(),
  suggestedBy: text('suggested_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const gameVotes = pgTable(
  'game_votes',
  {
    gameNightId: uuid('game_night_id').notNull(),
    userId: text('user_id').notNull(),
    gameOptionId: uuid('game_option_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.gameNightId, t.userId] })],
)

export const rsvps = pgTable(
  'rsvps',
  {
    gameNightId: uuid('game_night_id').notNull(),
    userId: text('user_id').notNull(),
    status: text('status').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.gameNightId, t.userId] })],
)
