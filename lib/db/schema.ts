import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, primaryKey, unique } from 'drizzle-orm/pg-core'

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
  rsvpDeadline: timestamp('rsvp_deadline', { withTimezone: true }),
  waitlistEnabled: boolean('waitlist_enabled').notNull().default(false),
  rsvpQuestion: text('rsvp_question'),
  schedulingDeadline: timestamp('scheduling_deadline', { withTimezone: true }),
  gameVotingDeadline: timestamp('game_voting_deadline', { withTimezone: true }),
  gameVoteMode: text('game_vote_mode').notNull().default('single'),
  recurrence: text('recurrence').notNull().default('none'),
  seriesId: uuid('series_id'),
  isTemplate: boolean('is_template').notNull().default(false),
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
  coverUrl: text('cover_url'),
  source: text('source').notNull().default('custom'),
  externalId: text('external_id'),
})

export const gameVotes = pgTable(
  'game_votes',
  {
    gameNightId: uuid('game_night_id').notNull(),
    userId: text('user_id').notNull(),
    gameOptionId: uuid('game_option_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.gameOptionId, t.userId] })],
)

export const rsvps = pgTable(
  'rsvps',
  {
    gameNightId: uuid('game_night_id').notNull(),
    userId: text('user_id').notNull(),
    status: text('status').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    answer: text('answer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.gameNightId, t.userId] })],
)

export const nightGames = pgTable(
  'night_games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameNightId: uuid('game_night_id').notNull(),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    coverUrl: text('cover_url'),
    backgroundUrl: text('background_url'),
    genres: jsonb('genres').$type<string[]>().notNull().default([]),
    platforms: jsonb('platforms').$type<string[]>().notNull().default([]),
    position: integer('position').notNull().default(0),
    addedBy: text('added_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.gameNightId, t.source, t.externalId)],
)

export const userGames = pgTable(
  'user_games',
  {
    userId: text('user_id').notNull(),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    coverUrl: text('cover_url'),
    backgroundUrl: text('background_url'),
    genres: jsonb('genres').$type<string[]>().notNull().default([]),
    platforms: jsonb('platforms').$type<string[]>().notNull().default([]),
    favorite: boolean('favorite').notNull().default(false),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.source, t.externalId] })],
)

export const nightHosts = pgTable(
  'night_hosts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameNightId: uuid('game_night_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    customRole: text('custom_role'),
    responsibilities: text('responsibilities').notNull().default(''),
    status: text('status').notNull().default('pending'),
    invitedBy: text('invited_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [unique().on(t.gameNightId, t.userId)],
)

export const nightActivities = pgTable('night_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameNightId: uuid('game_night_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull().default('custom'),
  gameName: text('game_name'),
  gameCoverUrl: text('game_cover_url'),
  startOffset: integer('start_offset').notNull().default(0),
  duration: integer('duration').notNull().default(30),
  description: text('description').notNull().default(''),
  discordChannel: text('discord_channel'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const activityHosts = pgTable(
  'activity_hosts',
  {
    activityId: uuid('activity_id').notNull(),
    userId: text('user_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.userId] })],
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    gameNightId: uuid('game_night_id'),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    href: text('href'),
    dedupeKey: text('dedupe_key'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.dedupeKey)],
)
