# GameHub

Party games in one Expo app. Opening the app shows the hub, which lists every game. Tap one to open it.

| Game | Players | What it is |
| --- | --- | --- |
| 🕵️ Imposter | 3–16, one phone or Wi-Fi | Everyone gets the secret word except the imposter. |
| 🤔 Who Am I? | 2+, one phone | Everyone writes a word for someone else, then holds the phone to their forehead and asks yes/no questions until they guess it. |

## Layout (Nx + npm workspaces)

```
apps/gamehub/            Expo app: the hub screen and the route files (app/<game>/...) that mount each game
libs/shared/core/        @gamehub/core      plain TS: GameMeta, shuffle, scoring helpers (no React Native)
libs/shared/ui/          @gamehub/ui        theme and shared components (buttons, leaderboard, timers, player list…)
libs/shared/lan/         @gamehub/lan       Android TCP/UDP Expo module + JSON-lines transport for Wi-Fi play
libs/games/imposter/     @gamehub/imposter
libs/games/who-am-i/     @gamehub/who-am-i
```

Each game library exports its screens, a `layout` (its own Stack and state) and a `meta` object for the hub card.
Route files in `apps/gamehub/app` are one-line re-exports of those screens.

## Commands

```sh
npm install
npm start                 # expo start (nx run gamehub:start)
npm run android           # build and run on Android
npm run typecheck         # every project
npm test                  # imposter Wi-Fi end-to-end test + who-am-i logic test
npx nx graph              # project dependency graph
```

## Adding a game

1. Create `libs/games/<id>` with a `package.json` named `@gamehub/<id>` (copy `who-am-i` as a starting point).
2. Add `"@gamehub/<id>": "*"` to `apps/gamehub/package.json` and run `npm install`.
3. Add route files under `apps/gamehub/app/<id>/` re-exporting its screens and layout.
4. Add its `meta` to `apps/gamehub/src/games.ts`.
