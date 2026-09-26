# Who Wants to Be a Grandparent? — Radhika's Godh Bharai

A static TV host + phone-player game.

## What changed

- Correct title: **Radhika's Godh Bharai**
- Three independent players: Puja, Marc, Nathalie.
- Each player gets their own three jokers: Diaper Surprise, Call the Dad (Martin), Ask the Parents.
- Players select and lock answers on their own phones.
- The TV host sees who has locked.
- The host cannot reveal the correct answer until all three players have locked.
- After the host advances to the suspense reveal, there is a **3-second pause**, then the correct answer turns green.
- Answer choices on the TV are revealed one-by-one with Right Arrow / Space.
- Host controls remain hidden until H is pressed.
- QR code is generated for the room on the TV.

## Important: phone joining needs a tiny realtime service

A QR code can open the hosted page on each phone, but a purely local `file://` page cannot synchronize phones over the internet. This build uses **Supabase Realtime Broadcast** for that synchronization. Supabase's Realtime Broadcast is intended for low-latency events and multiplayer game state. See:
https://supabase.com/docs/guides/realtime/broadcast

You need a Supabase project. No database tables are required for this version.

### 1. Create a Supabase project

Create a project at https://supabase.com/

### 2. Get the public browser credentials

In the Supabase dashboard, open the project's API/Connect settings and copy:
- Project URL
- Publishable key (`sb_publishable_...`) if your project provides it.
Legacy `anon` key also works with the current JS client, but prefer the publishable key.

Do NOT put a secret/service-role key in `config.js`.

### 3. Edit config.js

```js
window.GAME_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "YOUR-PUBLISHABLE-KEY"
};
```

### 4. Host the folder

GitHub Pages is ideal. The QR code will automatically point to:
`YOUR_SITE_URL/?join=ROOMCODE`

The TV host creates a room; the grandparents scan the QR code and choose Puja, Marc, or Nathalie.

## Testing

Open the hosted page on the TV and create a game. Scan the QR code with three phones. Each person chooses their name. Start the game from the TV with Right Arrow.

The player phones should only allow answer selection once the TV has revealed all four choices. Each player can lock independently.

Once all three are locked, Right Arrow on the TV starts the suspense sequence. One more Right Arrow starts the reveal, and the correct answer turns green after 3 seconds.

## Keyboard

- Right Arrow / Space: advance
- Left Arrow: back
- H: host controls
- Esc: close host controls

## Note on the "Call the Dad" joker

The current version records joker usage independently per player and reserves the joker for the host-led "Call the Dad" moment. It does not place a phone call automatically.

\n## Local soundtrack\n\nThe four supplied tracks are bundled under `audio/`: intro/waiting, guessing, locked/suspense, and winning. The soundtrack plays only on the TV host page. Browser autoplay policies can require the host to press a button or arrow once before audio starts.\n