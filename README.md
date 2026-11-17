[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/soshixos/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/soshixos/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Porto Verde

A sun-soaked, top-down (GTA 1-style) open-world crime game in a single HTML5
canvas. All art is procedural, no assets, no network. You play Dario Costa,
a getaway driver in the fictional coastal city of Porto Verde, working five
jobs for Madame Alba while the Vipers and the Porto Verde police try to stop
you.

## How to play

Serve the game (`node serve.ts --port 8080`) and open http://localhost:8080.

- **WASD / arrows** — move on foot (hold **Shift** to run)
- **Mouse** — aim
- **F** — punch
- **Click** — shoot (once the pistol is earned in Dock Run)
- **E** — enter / steal a car, exit a car, start a job at the yellow marker
- **Space** — handbrake while driving
- **P** — pause · **M** — mute

## The city

2560×1920, seeded so every run shows the same Porto Verde: six avenues,
six streets, five districts (Old Harbour, Neon Row, Palm Heights, The Docks,
Solmar Beach), traffic, pedestrians, and a beach on the south edge.

## Jobs (sequential)

1. **Wheels for Alba** ($300) — steal any car, drive it to the garage.
2. **Dock Run** ($500 + pistol) — pick up at the Docks, deliver to Club Alba in 150 s.
3. **Shake the Tail** ($600) — lose a 2-star wanted level, reach the Hideout.
4. **Warehouse Payback** ($800) — clear Warehouse 9 of 4 armed Vipers.
5. **The Verde Score** ($1500) — 4 checkpoints in 130 s, escape to Solmar Beach.

## Wanted

Crimes raise your wanted level (0–5 stars): witnessed theft, carjacking,
running over pedestrians, shooting near cops, killing cops. Lose the heat by
staying clean for 12 s, then one star fades every 7 s. Get caught on foot and
you're BUSTED; get your health to zero and you're WASTED.

Progress autosaves to localStorage every 15 s and on every completed job;
the title screen offers Continue when a save exists.

## Tech

Plain ES modules, no libraries, no network. Sound is fully synthesised
WebAudio (engine hum, sirens, gunshots, jingles). Entry point:
`game/index.html`, game code in `game/src/`.
