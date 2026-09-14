# Group Chat & Team Chat — Functionality Check

This document explains how **Group Chats** and **Team Chats** work, with a focus on the **access/membership checks** enforced before a user can create, view, or send messages in these chats.

---

## 1. Chat Types Overview

| Chat Type | `type` value | `referenceId` points to | Membership source |
|-----------|--------------|------------------------|-------------------|
| Direct    | `direct`     | —                      | Match between 2 users |
| **Group** | `group`      | `Group._id`            | `group.members` + `group.createdBy` |
| **Team**  | `team`       | `Team._id`             | `team.members` + `team.createdBy` + `team.captain` |
| Race      | `race`       | `Race._id`             | `race.participants` + `race.userId` |

A single `Chat` document stores all chat types. Group/Team/Race chats are found by the compound index `{ referenceId, type }`.

**Entity:** `src/chat/entities/chat.entity.ts`

```ts
type: 'direct' | 'group' | 'team' | 'race' | 'community' | 'pace'
referenceId?: Types.ObjectId   // Group ID / Team ID / Race ID
participants: Types.ObjectId[] // All users who can access the chat
groupName / groupImage         // Copied from group/team/race
isLocked                       // Group/Team/Race chats are always unlocked (false)
```

---

## 2. Access Checks (the "check" functionality)

### 2.1 Group Chat check — `getOrCreateGroupChat(groupId, userId)`

Location: `src/chat/chat.service.ts`

| Step | Check | Error thrown |
|------|-------|--------------|
| 1 | `groupId` is a valid ObjectId | `BadRequestException('Invalid group ID format')` |
| 2 | Group exists in DB | `NotFoundException('Group not found')` |
| 3 | User is `group.members` **OR** `group.createdBy` | `ForbiddenException('You are not a member of this group')` |

**Who passes the membership check:**
```ts
const isMember =
  group.members?.some(m => m.toString() === userId) ||
  group.createdBy?.toString() === userId;
```

**After passing:** all members + creator are deduplicated into `participants`. The chat is created if it doesn't exist; otherwise members/group name/image are **auto-synced** (and `isLocked` is reset to `false`).

### 2.2 Team Chat check — `getOrCreateTeamChat(teamId, userId)`

Location: `src/chat/chat.service.ts`

| Step | Check | Error thrown |
|------|-------|--------------|
| 1 | `teamId` is a valid ObjectId | `BadRequestException('Invalid team ID format')` |
| 2 | Team exists in DB | `NotFoundException('Team not found')` |
| 3 | User is `team.members` **OR** `team.createdBy` **OR** `team.captain` | `ForbiddenException('You are not a member of this team')` |

**Who passes the membership check:**
```ts
const isMember =
  team.members?.some(m => m.toString() === userId) ||
  team.createdBy?.toString() === userId ||
  team.captain?.toString() === userId;
```

**After passing:** members + creator + captain are deduplicated into `participants`, with the same auto-create / auto-sync behavior as group chats.

### 2.3 Message-send check — `sendMessage(userId, chatId, ...)`

Location: `src/chat/chat.service.ts`

Before saving a message the service runs `ensureChatAccess`: the sender must be a `chat.participants` entry. If not, it runs a **self-heal membership re-check** against the source entity:

- `type === 'group'` → re-checks the `Group` document (members / createdBy). If the user is a member, they are `$addToSet`-ed into `chat.participants` and allowed to send.
- `type === 'team'` → re-checks the `Team` document (members / createdBy / captain). Same self-heal behavior.
- `type === 'race'` → re-checks the `Race` document (participants / userId). Same self-heal behavior.

If the user is not a member of the source entity → `ForbiddenException('You are not a participant in this chat')`.

### 2.4 Read check — `getChat(chatId, userId)`

Same pattern as `sendMessage`: participant check first, then the self-heal membership re-check for `group`/`team`/`race` chats (auto-adds the user to participants if they are a member of the source entity), otherwise `ForbiddenException`.

### 2.5 Messages read check — `getMessages(chatId, userId)`

Uses the same shared `ensureChatAccess` check: chat must exist and the user must be a participant (with self-heal for group/team/race chats). Non-participants get `403 Forbidden` / a socket `error` event.

### 2.6 Chat update check — `update(chatId, userId, dto)`

`PATCH /chat/:id` now resolves `userId` from the JWT and passes it to the service, which runs `ensureChatAccess` before applying the update. Non-participants get `403 Forbidden`.

### 2.7 Shared helper — `ensureChatAccess(chatId, userId)` (private)

All per-chat access checks (`getChat`, `getMessages`, `sendMessage`, `update`, socket `joinRoom`) funnel through this single private method:

1. Validates the `chatId` ObjectId (400 on invalid).
2. Loads the chat (404 if missing).
3. If the user is in `chat.participants` → access granted.
4. Otherwise self-heal: for `group`/`team`/`race` chats, re-checks membership on the **source entity** (Group: members/createdBy · Team: members/createdBy/captain · Race: participants/userId) and auto-`$addToSet`s the user into participants.
5. Otherwise → `ForbiddenException('You are not a participant in this chat')`.

**ID fallback:** if `chatId` doesn't match any chat `_id`, the service checks whether it's a **group/team/race `referenceId`** and resolves it to the actual chat (creating the chat if it doesn't exist yet, with full membership enforcement). A console warning is logged so frontend misuse stays visible. `resolveChatId()` provides the same resolution for auxiliary actions (`readMessage`). All write/broadcast paths use the resolved chat `_id`.

---

## 3. Automatic Chat Lifecycle (entity → chat sync)

### Group side (`src/group/group.service.ts`)

| Action | Chat effect |
|--------|-------------|
| `create` group | Creates chat `{ type: 'group', referenceId: group._id }` with all members |
| `update` group (name/image/members) | `$set` `groupName` / `groupImage` / `participants` on chat |
| `addMembers` | `$addToSet` new members into chat participants |
| `leave` group | `$pull` user from chat participants |
| `delete` group | Deletes chat `{ referenceId, type: 'group' }` |

### Team side (`src/teams/teams.service.ts`)

| Action | Chat effect |
|--------|-------------|
| `create` team | Creates chat `{ type: 'team', referenceId: team._id }` with all members |
| `update` team (name/image) | `$set` `groupName` / `groupImage` on chat |
| `acceptInvite` | `$addToSet` user into chat participants |
| `joinByCode` | `$addToSet` user into chat participants |
| `leave` team | `$pull` user from chat participants |
| `delete` team | Deletes chat `{ referenceId, type: 'team' }` |

> ℹ️ Group and Team services wrap all chat operations in `try/catch` — a chat-sync failure never fails the main group/team operation (it is only logged).

### Chat side (lazy sync)

`getMyChats(userId)` auto-syncs: for every group/team/race the user belongs to, it upserts a chat document and `$addToSet` all members into participants. `getOrCreateGroupChat` / `getOrCreateTeamChat` also re-sync members + name + image on every call.

---

## 4. REST API Endpoints (`src/chat/chat.controller.ts`)

All routes require JWT (`AuthGuard('jwt')`), user resolved from `req.user.id`.

### Group chat
| Method | Route | Description | Check |
|--------|-------|-------------|-------|
| `GET` | `/chat/group/:groupId` | Get or start group chat | Group membership |
| `POST` | `/chat/group/:groupId` | Start or get group chat | Group membership |

### Team chat
| Method | Route | Description | Check |
|--------|-------|-------------|-------|
| `GET` | `/chat/team/:teamId` | Get or start team chat | Team membership |
| `POST` | `/chat/team/:teamId` | Start or get team chat | Team membership |

### Universal
| Method | Route | Description | Check |
|--------|-------|-------------|-------|
| `POST` | `/chat` | Universal create — accepts `groupId`, `teamId`, `raceId`, `targetUserId`, or `participants` | Routed to the matching `getOrCreate*Chat` (each with its own membership check) |
| `GET` | `/chat` | List my chats (with unread counts) | Auto-syncs chats from group/team/race membership |
| `GET` | `/chat/:id` | Chat details | Participant + self-heal |
| `GET` | `/chat/:id/messages` | Message history | Participant + self-heal |
| `POST` | `/chat/:id/message` | Send message | Participant + self-heal |
| `PATCH` | `/chat/:id` | Update chat (lock/expiry) | Participant + self-heal |

**Fallback routing in `createChat`:** `raceId`/`type='race'` → race chat, `groupId`/`type='group'` → group chat, `teamId`/`type='team'` → team chat, `targetUserId` → direct chat. A bare `referenceId` without a type looks up an existing chat and returns it **without a membership check** (only reused if the chat already exists).

---

## 5. Socket Events (`src/chat/chat.gateway.ts`)

Gateway mounted at base URL (`/`), CORS enabled. User identity is taken from `handshake.query.userId` (falls back to `data.userId` per event).

| Event (client → server) | Payload | Server behavior | Check applied |
|--------------------------|---------|-----------------|---------------|
| `joinGroupChat` | `{ userId, groupId }` | `getOrCreateGroupChat` → joins socket room `chat._id`, emits `chatJoined` | Group membership |
| `joinTeamChat` | `{ userId, teamId }` | `getOrCreateTeamChat` → joins socket room, emits `chatJoined` | Team membership |
| `joinDirectChat` / `joinMatchedChat` | `{ userId, targetId }` | Direct chat join | Match check |
| `joinRaceChat` | `{ userId, raceId }` | Race chat join | Race participation |
| `joinRoom` | `{ chatId }` | Verifies access via `getChat` (participant + self-heal), then joins the room | Participant + self-heal |
| `sendMessage` | `{ chatId, senderId, content, type, metadata }` | Persists message, broadcasts `newMessage` to the **resolved** chat room | Participant + self-heal (in service) |
| `getChatMessages` | `{ chatId, userId }` | Emits `messages` | Participant + self-heal (in service); errors now returned instead of crashing |
| `getChatList` | `{ userId }` | Emits `chatList` | Returns own chats only |
| `readMessage` | `{ chatId, userId }` | Resolves ID, marks read, emits `messagesRead` with resolved `chatId` | — |
| `deleteMessage` | `{ messageIds, userId, chatId, mode }` | `mode: 'me' \| 'everyone'`, emits `messagesDeleted` | `'everyone'` restricted to sender in service |
| `typing` | `{ chatId, userId, isTyping }` | Broadcasts `userTyping` to room | — |

**On connect:** user's online status is broadcast (`userStatusChanged`) and the user auto-joins socket rooms for **all** their chats (direct + group + team + race) via `getMyChats`.

---

## 6. Verification Summary

✅ **Working correctly**
- Group chat requires group membership (member or creator) before create/join
- Team chat requires team membership (member, creator, or captain) before create/join
- Message sending re-validates membership with self-heal for group/team/race chats
- Leaving a group/team removes the user from chat participants
- Deleting a group/team deletes the associated chat
- Group/team detail updates (name, image) propagate to the chat document
- Invalid ID formats are rejected with 400; missing entities with 404

⚠️ **Gaps / risks found**

**Fixed (this change):**
1. ~~`getMessages(chatId, userId)` — no participant check~~ → now runs `ensureChatAccess` (participant + self-heal) on both REST and socket paths.
2. ~~`joinRoom` socket event — no membership check~~ → now verifies access via `getChat` before joining the room.
3. ~~`PATCH /chat/:id` — no ownership validation~~ → `update()` now takes `userId` from JWT and runs `ensureChatAccess`.

**Remaining:**
4. `createChat` fallback with plain `referenceId` returns an existing chat without a membership check.
5. Socket identity is client-supplied (`handshake.query.userId` / `data.userId`) — no JWT verification at connection time, so `userId` fields are spoofable at the socket layer.
6. `sendMessage` notification loop sends sequentially per recipient (fine for small groups, worth noting for large teams).

> ℹ️ Note: `getMessages` / `sendMessage` / `joinRoom` now also accept a group/team/race `referenceId` in place of `chatId` and auto-resolve it (with a warning log). This is a compatibility fallback — clients should still send the real chat `_id`.

---

## 7. Flow Diagrams

### Group chat access flow
```
User → GET/POST /chat/group/:groupId (JWT)
         │
         ▼
   groupId valid? ──no──► 400 Invalid group ID format
         │ yes
         ▼
   Group exists? ──no──► 404 Group not found
         │ yes
         ▼
   member ∨ createdBy? ──no──► 403 Not a member of this group
         │ yes
         ▼
   Chat exists (referenceId + type='group')?
      ├─ no  → create chat with all members, isLocked=false
      └─ yes → sync members/name/image if changed
         ▼
   Return populated chat
```

### Team chat access flow
```
User → GET/POST /chat/team/:teamId (JWT)
         │
         ▼
   teamId valid? ──no──► 400 Invalid team ID format
         │ yes
         ▼
   Team exists? ──no──► 404 Team not found
         │ yes
         ▼
   member ∨ createdBy ∨ captain? ──no──► 403 Not a member of this team
         │ yes
         ▼
   Chat exists (referenceId + type='team')?
      ├─ no  → create chat with members+creator+captain, isLocked=false
      └─ yes → sync members/name/image if changed
         ▼
   Return populated chat
```

### Chat ID resolution (sendMessage / getMessages / joinRoom / readMessage)
```
Client sends chatId = ?
      │
      ▼
Is a chat _id? ──yes──► use it
      │ no
      ▼
Is a User _id? ──yes──► get-or-create 1-on-1 direct chat with that user (match enforced)
      │ no
      ▼
Matches a chat referenceId? ──yes──► resolve to that chat (+ console.warn)
      │ no
      ▼
Is a Group/Team/Race _id? ──yes──► getOrCreate*Chat (membership enforced) → use chat _id
      │ no
      ▼
404 Chat not found for id: "..."
```

**`entityId` in chat list:** `getMyChats` now returns an `entityId` per chat — the **other user's `userId`** for direct chats, or the **group/team/race `referenceId`** otherwise. This is exactly the identifier the frontend navigates with, and it is accepted anywhere a `chatId` is expected (`resolveChatId()` performs the resolution; all write/broadcast paths use the resolved chat `_id`).
