# @rafiki270/teams

Reusable Team + Team Settings module for Fastify + Prisma.

## Install

```bash
npm install @rafiki270/teams
```

## Usage

```ts
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { registerTeamRoutes, registerUserTeamSettingsRoutes } from "@rafiki270/teams";
import { requireAuth } from "./auth/guard";

const app = Fastify();
const prisma = new PrismaClient();

await registerTeamRoutes(app, {
  prisma,
  inboundEmailDomain: process.env.INBOUND_EMAIL_DOMAIN || "local.example",
  requireAuth,
});

await registerUserTeamSettingsRoutes(app, {
  prisma,
  requireAuth,
});
```

### Request auth shape

`requireAuth` must populate `request.auth.user.id` (compatible with `rafiki270/auth`).

### Prisma model requirements

Add the enums and models below to your Prisma schema. These match the reference implementation.

```prisma
enum TeamMemberRole {
  owner
  admin
  member
}

enum TeamVertical {
  regular
  hospitality
  retail
}

enum ExportPreset {
  global
  us
  gb
  ca
  au
  de
  fr
}

enum OverviewStatsPeriod {
  rolling_30_days
  calendar_month
}

model User {
  id               String   @id @default(uuid())
  username         String   @unique
  email            String?  @unique
  fullName         String?
  avatarUrl        String?
  status           UserStatus @default(active)
  isSuperUser      Boolean    @default(false)
  lastActiveTeamId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  teamMemberships  TeamMember[]
  createdTeams     Team[]     @relation("TeamOwner")
  lastActiveTeam   Team?      @relation("LastActiveTeam", fields: [lastActiveTeamId], references: [id])
  userTeamSettings UserTeamSetting[]
}

model Team {
  id                        String              @id @default(uuid())
  name                      String
  slug                      String              @unique
  vertical                  TeamVertical        @default(regular)
  inboxBase                 String
  createdByUserId           String
  planName                  String              @default("free")
  planLimit                 Int                 @default(25)
  planPriceOverrideOne      Int?
  planPriceOverrideTeam     Int?
  stripeCustomerId          String?             @unique
  stripeSubscriptionId      String?             @unique
  subscriptionStatus        String?
  billingInterval           String?
  billingCurrency           String?             @default("GBP")
  seatBundleCount           Int                 @default(1)
  storageAddOnCount         Int                 @default(0)
  integrationAddOnCount     Int                 @default(0)
  prioritySupportAddOnCount Int                 @default(0)
  billingPeriodStart        DateTime?
  billingPeriodEnd          DateTime?
  defaultCurrency           String?             @default("GBP")
  country                   String?
  timezone                  String?
  vatRegistered             Boolean             @default(false)
  vatMissingThresholdMinor  Int?
  vatNumberRequired         Boolean             @default(false)
  categoryRequired          Boolean             @default(false)
  defaultExportPreset       ExportPreset        @default(global)
  storageLimitBytes         BigInt              @default(1073741824)
  overviewStatsPeriod       OverviewStatsPeriod @default(rolling_30_days)
  createdAt                 DateTime            @default(now())
  updatedAt                 DateTime            @updatedAt

  createdBy       User              @relation("TeamOwner", fields: [createdByUserId], references: [id])
  lastActiveUsers User[]            @relation("LastActiveTeam")
  members         TeamMember[]
  userTeamSettings UserTeamSetting[]
}

model TeamMember {
  id        String         @id @default(uuid())
  teamId    String
  userId    String
  role      TeamMemberRole @default(member)
  createdAt DateTime       @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
}

model UserTeamSetting {
  id        String   @id @default(uuid())
  userId    String
  teamId    String
  key       String
  value     Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId, key])
  @@index([teamId])
  @@index([userId])
}
```

## License

MIT
