# 💬 Chat Socket Integration Guide (Frontend)

Real-time chat integration for the **ConnectRun** API — covers **Direct**, **Group**, **Team**, and **Race** chats.

- **Socket.IO server** — mounted on the **base URL** (`wss://<your-api-host>/`), CORS enabled (any origin).
- **Client library** — `socket.io-client` v4.
- All examples use JavaScript. Event names and payloads are exactly what the backend emits/expects.

---

## 1. Connection

The user identity is passed in the **query string** at connect time:

```js
import { io } from 'socket.io-client';

const socket = io('https://api.yourapp.com', {
  query: { userId: loggedInUserId },   // 👈 REQUIRED — backend uses this for identity
  transports: ['websocket'],           // recommended (avoids polling upgrade)
  reconnection: true,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});
```

### What happens automatically on connect
1. Backend marks the user **online** and broadcasts `userStatusChanged` to everyone.
2. Backend auto-joins your socket to **all your chat rooms** (direct + group + team + race) and emits you the full `chatList`.

> ⚠️ Note: identity is currently client-supplied. Send the *authenticated* user's ID only — spoofing other users' IDs is possible at the socket layer today (JWT auth on sockets is planned).

---

## 2. Server → Client (Listeners) — things you LISTEN to

| Event | When you receive it | Payload |
|-------|--------------------|---------|
| `chatList` | On connect + whenever you emit `getChatList` | `ChatSummary[]` |
| `chatJoined` | After any successful `join*Chat` event | Full chat object |
| `newMessage` | When **any** message is sent to a room you joined | `Message` object |
| `messages` | After you emit `getChatMessages` | `Message[]` |
| `messagesRead` | When someone in a chat reads messages | `{ chatId, userId }` |
| `messagesDeleted` | When messages are deleted | `{ messageIds, chatId, mode }` |
| `userTyping` | When someone types in a chat | `{ userId, isTyping, chatId }` |
| `userStatusChanged` | Any user comes online / goes offline | `{ userId, isOnline, lastSeen? }` |
| `error` | Any join/send error | `{ message }` |

### Listener reference

#### `chatList`
Emitted on connect and after `getChatList`.

```js
socket.on('chatList', (chats) => {
  // chats: ChatSummary[]
  // {
  //   chatId: string,               // canonical CHAT id (socket room id)
  //   entityId: string | null,      // 👈 the id YOU navigate with:
  //                                 //    1-on-1 → the OTHER user's userId
  //                                 //    group/team/race → the group/team/race id
  //   type: 'direct' | 'group' | 'team' | 'race',
  //   participants: [{ _id, first_name, last_name, display_name, image, isOnline, lastSeen }],
  //   lastMessage: string,          // preview, e.g. "📷 Image" for media
  //   lastActivity: Date,
  //   isLocked: boolean,
  //   unreadCount: number,
  //   groupName: string | null,     // set for group/team/race chats
  //   groupImage: string | null,
  //   referenceId: string | null,   // Group/Team/Race ID (same as entityId for group chats)
  // }
});
```

> 💡 **You don't need to store `chatId` at all.** Every server event that takes a `chatId` (`sendMessage`, `getChatMessages`, `readMessage`, `joinRoom`) also accepts the `entityId` — the other user's `userId` for 1-on-1 chats, or the `groupId`/`teamId`/`raceId` for group chats. The backend resolves it to the canonical chat automatically (creating the chat on first use, with membership checks).

#### `newMessage`
The core real-time event. Sent to **every socket in the room** (including the sender — use it to confirm optimistic sends).

```js
socket.on('newMessage', (message) => {
  // {
  //   _id: string,
  //   chatId: string,
  //   senderId: { _id, first_name, last_name, display_name, image },  // populated
  //   content: string,
  //   type: 'text' | 'image' | 'video' | 'invite' | 'system',
  //   metadata?: object,
  //   readBy: string[],      // user IDs
  //   isDeleted: boolean,
  //   createdAt: Date,
  //   updatedAt: Date,
  // }
  if (message.chatId === activeChatId) {
    appendToConversation(message);
  } else {
    incrementUnreadBadge(message.chatId);
  }
});
```

#### `userTyping` / `messagesRead` / `messagesDeleted` / `userStatusChanged`

```js
socket.on('userTyping', ({ chatId, userId, isTyping }) => {
  if (chatId === activeChatId && userId !== myUserId) {
    showTypingIndicator(userId, isTyping);   // isTyping: boolean
  }
});

socket.on('messagesRead', ({ chatId, userId }) => {
  // mark outgoing messages in `chatId` as "seen" by `userId`
});

socket.on('messagesDeleted', ({ messageIds, chatId, mode }) => {
  // mode: 'everyone' → remove from all UIs
  // mode: 'me'       → only the deleting client receives this; remove locally
  removeMessagesFromUI(messageIds);
});

socket.on('userStatusChanged', ({ userId, isOnline, lastSeen }) => {
  updatePresenceInChatList(userId, isOnline, lastSeen);
});

socket.on('error', ({ message }) => {
  // e.g. "You are not a participant in this chat", "Group not found"
  showErrorToast(message);
});
```

---

## 3. Client → Server (Emitters) — things you EMIT

| Event | When to emit | Payload | Ack / Response |
|-------|-------------|---------|----------------|
| `joinDirectChat` / `joinMatchedChat` | Open a 1-on-1 chat | `{ userId, targetId }` | ack `{ status, chatId, chat }` |
| `joinGroupChat` | Open a group chat | `{ userId, groupId }` | ack `{ status, chatId, chat }` |
| `joinTeamChat` | Open a team chat | `{ userId, teamId }` | ack `{ status, chatId, chat }` |
| `joinRaceChat` | Open a race chat | `{ userId, raceId }` | ack `{ status, chatId, chat }` |
| `joinRoom` | Rejoin by chatId you already have | `{ chatId }` | ack `{ status, chatId }` |
| `getChatList` | Refresh the chat list | `{ userId? }` | ack: `ChatSummary[]` + `chatList` event |
| `sendMessage` | Send a message | `{ chatId, senderId, content, type?, metadata? }` — `chatId` accepts chat `_id`, other user's `userId`, or group/team/race id | ack: `Message` |
| `getChatMessages` | Load history | `{ chatId, userId? }` | ack `{ status, messages }` + `messages` event |
| `typing` | User starts/stops typing | `{ chatId, userId, isTyping }` | — |
| `readMessage` | Chat window is open/focused | `{ chatId, userId }` | — (broadcasts `messagesRead`) |
| `deleteMessage` | Delete message(s) | `{ messageIds, userId, chatId, mode }` | ack `{ status, deletedCount, messageIds }` |

### Emitter reference

#### 3.1 Joining a chat

Pick the event matching the chat type — the backend **enforces membership** (403-style error event if you're not a member):

```js
// Direct (matched users only)
socket.emit('joinDirectChat', { userId: myUserId, targetId: otherUserId });

// Group
socket.emit('joinGroupChat', { userId: myUserId, groupId });

// Team
socket.emit('joinTeamChat', { userId: myUserId, teamId });

// Race
socket.emit('joinRaceChat', { userId: myUserId, raceId });

// All of them respond the same way:
socket.emit('joinGroupChat', { userId: myUserId, groupId }, (res) => {
  if (res.status === 'joined') {
    setActiveChat(res.chat);     // full chat object — save res.chat._id as chatId
  } else {
    showError(res.message);      // e.g. "You are not a member of this group"
  }
});
```

Or, if you already know any identifier — chat `_id`, the other user's `userId`, or a group/team/race id:

```js
socket.emit('joinRoom', { chatId: anyOfTheseIds }, (res) => {
  if (res.status === 'joined') setActiveChatId(res.chatId);  // canonical chat id
  else showError(res.message);
});
```

#### 3.2 Sending messages

The `chatId` field accepts **any** of these identifiers — the backend resolves it:
- the chat `_id` (canonical), **or**
- the **other user's `userId`** (for 1-on-1 chats — chat is auto-created if missing), **or**
- a **`groupId` / `teamId` / `raceId`** (chat is auto-created if missing)

```js
// 1-on-1: just send the other user's id
socket.emit('sendMessage', {
  chatId: otherUserId,          // 👈 userId works!
  senderId: myUserId,
  content: 'Hey, nice pace today!',
  type: 'text',
});

// Group/team/race: send the entity id
socket.emit('sendMessage', {
  chatId: groupId,              // 👈 groupId/teamId/raceId works!
  senderId: myUserId,
  content: 'Run at 6am tomorrow?',
});

// Recommended: use the ack to confirm + handle errors
socket.emit('sendMessage', payload, (res) => {
  if (res?.status === 'error') {
    showError(res.message);     // e.g. "You can only chat with matched users"
  }
  // on success, the message also arrives via the 'newMessage' broadcast
  // (res.chatId is the canonical chat _id if you want to store it)
});
```

> ⚠️ For 1-on-1 chats the **match requirement still applies** — you can only message users you're matched with (`ForbiddenException` otherwise). Group/team/race chats enforce membership the same way.

#### 3.3 Typing indicator (throttle this!)

```js
let typingTimeout;
function onInputChange() {
  socket.emit('typing', { chatId, userId: myUserId, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { chatId, userId: myUserId, isTyping: false });
  }, 2000); // auto "stopped typing" after 2s idle
}
```

#### 3.4 Read receipts

```js
// When the chat screen is open/focused:
socket.emit('readMessage', { chatId, userId: myUserId });
// Other members receive: { event: 'messagesRead', payload: { chatId, userId } }
```

#### 3.5 Loading history

```js
socket.emit('getChatMessages', { chatId: otherUserId, userId: myUserId });
// chatId here can be: chat _id, the other user's userId, or group/team/race id

socket.on('messages', (messages) => {
  // messages: Message[] sorted oldest → newest
  renderConversation(messages);
});
```

> 💡 You can also load history via REST: `GET /chat/:chatId/messages` (JWT-authorized). Use whichever fits your data layer.

#### 3.6 Refreshing the chat list

```js
socket.emit('getChatList', { userId: myUserId });
// response arrives via the 'chatList' listener (and as the emit ack)
```

#### 3.7 Deleting messages

```js
// mode: 'everyone' — only the original sender can do this (enforced server-side)
socket.emit('deleteMessage', {
  messageIds: [msgId],
  userId: myUserId,
  chatId,
  mode: 'everyone',
});

// mode: 'me' — hides only for this user
socket.emit('deleteMessage', { messageIds: [msgId], userId: myUserId, chatId, mode: 'me' });
```

---

## 4. Typical Screens

### A. Chat list screen
1. `chatList` listener → render list (sort by `lastActivity` desc — server already sorts).
2. Show `unreadCount`, `lastMessage` preview, `groupName` (fallback: other participant's `display_name` for direct chats).
3. `userStatusChanged` → update online dots.
4. `newMessage` → bump chat to top, increment unread, update preview.

### B. Conversation screen
1. Emit `join*Chat` (or `joinRoom`) → then `getChatMessages`.
2. `messages` listener → render history.
3. `newMessage` listener → append (dedupe by `_id` — your own sends arrive via broadcast too).
4. On input change → `typing`; on focus/open → `readMessage`.
5. On leave → emit `typing` with `isTyping: false` (socket stays in the room; background messages feed the badge).

---

## 5. Complete Minimal Example

```js
import { io } from 'socket.io-client';

class ChatSocket {
  constructor(userId, handlers) {
    this.userId = userId;
    this.socket = io('https://api.yourapp.com', {
      query: { userId },
      transports: ['websocket'],
    });
    this._listen('chatList', handlers.onChatList);
    this._listen('chatJoined', handlers.onChatJoined);
    this._listen('newMessage', handlers.onNewMessage);
    this._listen('messages', handlers.onMessages);
    this._listen('messagesRead', handlers.onMessagesRead);
    this._listen('messagesDeleted', handlers.onMessagesDeleted);
    this._listen('userTyping', handlers.onUserTyping);
    this._listen('userStatusChanged', handlers.onUserStatusChanged);
    this._listen('error', handlers.onError);
  }

  _listen(event, handler) {
    this.socket.on(event, (payload) => handler?.(payload));
  }

  joinChat({ type, referenceId }) {
    // NOTE: direct chats use 'targetId'; group/team/race use '<type>Id'
    const event = {
      direct: 'joinDirectChat',
      group: 'joinGroupChat',
      team: 'joinTeamChat',
      race: 'joinRaceChat',
    }[type];
    const payload =
      type === 'direct'
        ? { userId: this.userId, targetId: referenceId }
        : { userId: this.userId, [`${type}Id`]: referenceId };
    return new Promise((resolve, reject) => {
      this.socket.emit(event, payload,
        (res) => (res.status === 'joined' ? resolve(res.chat) : reject(res)));
    });
  }

  joinRoom(chatId) {
    return new Promise((resolve, reject) => {
      this.socket.emit('joinRoom', { chatId },
        (res) => (res.status === 'joined' ? resolve(res.chatId) : reject(res)));
    });
  }

  sendMessage(chatId, content, type = 'text', metadata) {
    return new Promise((resolve, reject) => {
      this.socket.emit('sendMessage',
        { chatId, senderId: this.userId, content, type, metadata },
        (res) => (res?.status === 'error' ? reject(res) : resolve(res)));
    });
  }

  loadMessages(chatId) {
    this.socket.emit('getChatMessages', { chatId, userId: this.userId });
  }

  typing(chatId, isTyping) {
    this.socket.emit('typing', { chatId, userId: this.userId, isTyping });
  }

  markRead(chatId) {
    this.socket.emit('readMessage', { chatId, userId: this.userId });
  }

  deleteMessages(chatId, messageIds, mode = 'everyone') {
    return new Promise((resolve, reject) => {
      this.socket.emit('deleteMessage',
        { chatId, userId: this.userId, messageIds, mode },
        (res) => (res?.status === 'error' ? reject(res) : resolve(res)));
    });
  }

  refreshChatList() {
    this.socket.emit('getChatList', { userId: this.userId });
  }

  disconnect() {
    this.socket.disconnect();
  }
}

export default ChatSocket;
```

> ⚠️ **React Native / web navigation caveat:** `getMyChats` rooms are auto-joined on connect, but for reliability always emit the specific `join*Chat` event when opening a chat screen — it also returns the fresh chat object **with the `chatId` (`res.chat._id`) you must use for all subsequent events**.

---

## 6. Error Handling Cheat Sheet

| Situation | What the client gets |
|-----------|---------------------|
| Not a member of group/team/race chat | `error` event + ack `{ status: 'error', message: 'You are not a member of this group' }` (team: `'...of this team'`) |
| Direct chat with a non-matched user | `{ status: 'error', message: 'You can only chat with matched users' }` |
| Chat does not exist and id matches nothing | `{ status: 'error', message: 'Chat not found for id: "..."' }` |
| Malformed ID (not an ObjectId) | `{ status: 'error', message: 'Invalid chat ID format: "..."' }` |
| Sending without membership | `{ status: 'error', message: 'You are not a participant in this chat' }` |
| Missing `chatId` or `senderId` on sendMessage | `{ status: 'error', message: 'chatId is required' / 'senderId is required' }` |
| Joining without `chatId` | `{ status: 'error', message: 'chatId is required' }` |
| Another member deletes for everyone | `messagesDeleted` broadcast |

---

## 7. REST Fallbacks (JWT-authorized)

Everything above also has REST equivalents in `src/chat/chat.controller.ts` if you prefer fetch-based flows:

| Purpose | REST endpoint |
|---------|--------------|
| Open/start any chat | `POST /chat` with `{ targetUserId \| groupId \| teamId \| raceId }` |
| Group chat | `GET/POST /chat/group/:groupId` |
| Team chat | `GET/POST /chat/team/:teamId` |
| Race chat | `GET/POST /chat/race/:raceId` |
| Direct chat | `GET/POST /chat/direct/:targetUserId` |
| Chat list | `GET /chat` |
| Chat details | `GET /chat/:id` |
| History | `GET /chat/:id/messages` |
| Send message | `POST /chat/:id/message` with `{ content, type?, metadata? }` |

**Recommended hybrid:** REST for history + sending (reliable, retryable), sockets only for live updates (`newMessage`, `typing`, presence).
