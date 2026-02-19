
# Player Self-Registration with Session ID

## The Problem

Currently, an admin can add any player name to the queue for anyone. But browser notifications only work for the person who has the page open. So if player "Atheros" adds "Zezinho" to the queue, "Zezinho" will never see the notification — only whoever added them would see it.

The fix: **each player registers themselves**, and the system ties their queue entry to a browser session ID stored in `localStorage`. This way:
- Only you can add yourself
- The notifications show up on your browser
- The admin (with password) can still remove anyone from the queue if needed

---

## How It Will Work

### Step 1 — Player Opens the Page

When someone visits `/hunt-admin`, they **don't need the password** to:
- See the list of cities and spots
- See how many people are in each queue
- Join a queue (as themselves)

The admin password is only needed to:
- Start/End hunts
- Manage cities and spots
- See player names in the queue

### Step 2 — Session ID Generation

When a player first visits the page, a unique **session ID** is generated and stored in `localStorage`:

```
localStorage.key: "hunt_session_id"
localStorage.value: "a1b2c3d4-e5f6-..." (UUID)
```

This ID is **permanent per browser** (survives page refreshes, but not clearing localStorage).

### Step 3 — Adding to Queue

The `hunt_queue` table gets a new column: `session_id (text, nullable)`.

When a player clicks "Join Queue":
1. They type only their nick
2. The system checks: is there already a queue entry with **this session_id** that is `waiting` or `notified`? → Block with error message: *"You are already in a queue. Leave it before joining another."*
3. It also checks: is this nick already in any active queue? → Block with: *"This nick is already in a queue."*
4. If all clear → inserts with their `session_id` attached

### Step 4 — My Spot Panel

A **"My Spot"** section appears at the top of the page (visible to everyone, no password needed):

```
┌─────────────────────────────────────────┐
│ 🎯 Your Queue Status                    │
│ You are #2 in line at Venore — Edron    │
│ Status: Waiting                         │
│ [Leave Queue]                           │
└─────────────────────────────────────────┘
```

If the player is **notified** (their turn is coming):
```
┌─────────────────────────────────────────┐
│ 🔔 Your turn is coming!                 │
│ You have 5 minutes to confirm at        │
│ Venore — Edron                          │
│ [✅ I'm on my way!]  [Leave Queue]      │
└─────────────────────────────────────────┘
```

### Step 5 — Notifications

Since each player is on the page with their own `session_id`, the 30s polling in `useHuntAdmin` can filter and detect if **this user specifically** was notified — and trigger the browser notification on their screen.

---

## Technical Changes

### Database Migration
Add `session_id` column to `hunt_queue`:
```sql
ALTER TABLE public.hunt_queue 
ADD COLUMN session_id text;
```

### New Hook: `usePlayerSession.ts`
Manages the player's own session:
- Generates/retrieves `session_id` from `localStorage`
- Tracks if the player is in any queue (`myQueueItem`)
- Detects when their status changes to `notified` and fires browser notification
- Returns `myQueueItem`, `leaveQueue()`, `claimMySpot()`

### Updated: `useHuntAdmin.ts`
- `addToQueue()` now requires `session_id` as a parameter
- Validates: no duplicate `session_id` in active queues
- Validates: no duplicate `player_name` in active queues

### Updated: `HuntQueuePanel.tsx`
- Receives `playerSessionId` as a prop
- "Add" button only adds the current player (no typing someone else's name)
- If player is already in a queue elsewhere → shows a message instead of the button
- Admin (with password) still sees the "Remove" button for all entries

### Updated: `AddToQueueModal.tsx`
- No longer a generic "type any name" form
- Shows: "Join as: [your nick]" with a single nick input
- Includes a warning: "You can only be in one queue at a time"

### New Component: `MyQueueStatus.tsx`
Persistent banner at the top of the page (outside login gate):
- Shows the player's current queue position and spot
- Shows "Your turn!" alert when notified
- "I'm on my way!" (claim) button
- "Leave Queue" button

### Updated: `HuntAdminPage.tsx`
- `MyQueueStatus` renders before the password gate
- Passes `playerSessionId` down through the component tree
