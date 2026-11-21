# Look and feel

Applies to every page and component of the web app, which are built from `packages/ui`. Change these rules here first,
then in code.

## Colour

Black or white (following the system's light or dark setting; there is no switch in the app) with one pink, a
magenta (hue 345). **Pink says three things: what you can act on, where you are, and what you asked.**

| Role                                     | Token                        | Light                                   | Dark                                     |
| ---------------------------------------- | ---------------------------- | --------------------------------------- | ---------------------------------------- |
| The main action (Send): a pink fill      | `--primary`                  | `oklch(0.56 0.2 345)`, white text 5.2:1 | `oklch(0.76 0.15 345)`, black text 8.6:1 |
| What you asked: the task of a comparison | `--asked`                    | `oklch(0.56 0.2 345)`, white text 5.2:1 | the same: white text in both themes      |
| Pink as text: links                      | `--brand` (`text-brand`)     | `oklch(0.53 0.2 345)`, 5.9:1            | `oklch(0.8 0.12 345)`, 10:1              |
| Where you are: a selected item           | `--selected` (`bg-selected`) | `oklch(0.965 0.018 345)`                | `oklch(0.27 0.06 345)`                   |
| Keyboard focus                           | `--ring`                     | `oklch(0.62 0.19 345)`, 4:1             | `oklch(0.72 0.16 345)`, 7.4:1            |

Everything else stays black, white and greys, with two tones for the state of a run:

| State of a run | Tone                  | Also shown by                |
| -------------- | --------------------- | ---------------------------- |
| Running        | grey                  | its icon and the word        |
| Succeeded      | green (`--success`)   | its icon and the word        |
| Incomplete     | grey                  | its icon, the word, a reason |
| Failed         | red (`--destructive`) | its icon, the word, a reason |
| Cancelled      | grey                  | its icon and the word        |

One stated exception: **what a command printed is shown as a terminal**, light text on a near-black panel in both
themes, with the colours the command itself used. It is the command's output, not the app's palette.

A second one: **code keeps its syntax colours**, GitHub's default light and dark themes. A snippet in an agent's
message and the file viewer share them, and share one frame: a muted label, then the code on an inset panel in the
page's background, with line numbers, at 14 px. Both read as one product.

A third one: **the logo keeps its own colours.** A bobble hat over a ski mask whose lens is a terminal prompt, in
the accent's three pinks and one ink, the same in both themes. The product has no name: the logo stands for it, alone in the page
header and, as a simpler drawing, in the browser tab.

Red is for errors only. The quiet action (Stop) is a bordered button, never pink and never red, so an action never
reads as a warning.

**An agent has no colour.** The two agents are told apart by their name, their icon and their column. Giving each an
accent colour would give pink a second job, and would make one agent look like "the pink one".

Every pair above passes WCAG AA (4.5:1 for text, 3:1 for the focus ring), in both modes. Colour is never the only
signal: each action and each state also has its icon and its word.

## Typography

Inter, stored with the app: its latin file only (48 KB). While it loads, Arial resized to Inter's metrics
(`Inter Fallback`), so the text does not move when it arrives. Weights 400, 500 and 600.

Six sizes, Tailwind's own steps: `text-xs` 12 (counts, captions), `text-sm` 14 (buttons, fields, the events of a run:
the working size), `text-base` 16 (reading text: what an agent says), `text-lg` 18 (section headings), `text-xl` 20
(card and dialog titles), `text-2xl` 24 (page titles, `font-semibold tracking-tight`).

Numbers that are compared line up: `tabular-nums` (or `data-numeric`) on durations, token counts and costs, never on
whole tables: Inter's tabular setting also widens hyphens.

## Icons

Lucide only, 16 px, stroke 2, the colour of the text beside it. One icon per concept, the same everywhere: the list
is `packages/ui/src/icons.ts` (`ICONS`); add a concept there before using a new icon. An icon never stands alone on
an action: it sits before its label, or, where space is short, carries a tooltip and a screen-reader name.

## Motion

**Motion belongs to the run: the slope, its tracks, its finish. Anywhere else, it only answers what the user just
did.** A motion that explains nothing is left out.

The reason is a sentence about who made this: Stéphane Pires makes interfaces where every motion explains
something, and he signs his work. In his own words: "soft touch, non intrusive, motion should always help the
interface become more understandable".

### The run

The slope is where a comparison happens (`components/run-tracks.tsx`). It is the one thing a visitor should
remember.

| Moment               | Trigger                   | What moves                                                                                                                            | Time                      | What it tells                                                   |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| The slope waits      | The empty page opens      | The two tracks of the picture draw themselves once                                                                                    | 1.2 s                     | Two agents, one slope                                           |
| A run is under way   | Events of the run         | Its track grows; a gate appears where each tool call started; the slope scrolls sideways to follow once the tracks outgrow their room | live, a tick every 250 ms | Both agents work, and who is ahead                              |
| A run ends           | Its outcome arrives       | Its flag and its time appear on the track                                                                                             | 240 ms                    | It ended, in this time                                          |
| Every agent finished | The last run did its task | Pink snow falls once over the page                                                                                                    | 5 s                       | The one celebration: never for a run that failed or was stopped |

The scale of the slope never changes: one turn of a track is one second. A run is never redrawn at another size;
its track only gets longer, a run that ended stays where it ended, and the slope can be scrolled back afterwards.

A gate that is pointed at says when exactly, what was called and how it stands.

The tracks are drawn from what happens: a gate stands at the moment the browser learnt of the tool call, and the
track ends when the run does. The time written at the flag is the API's measure of the run.

A run in progress also shows a spinner, and text appears as the agent writes it: both report work happening now.

### Answers to the user

| Trigger                    | What moves                                                        | Time                                 |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Hover, press               | Colour                                                            | 120 ms (`--duration-fast`)           |
| Something leaves           | It fades                                                          | 180 ms (`--duration-base`, ease-in)  |
| Something moves or arrives | It moves                                                          | 240 ms (`--duration-slow`, ease-out) |
| A wrong password           | The padlock shakes once                                           | 320 ms                               |
| The right password         | The padlock's shackle lifts, then the locker gives way to the app | 240 ms, then 240 ms                  |
| The logo is pointed at     | Its hat hops once and its cursor blinks: it can be clicked        | 500 ms                               |

Dialogs and menus keep their library's short defaults.

### Never

Numbers counting up, bounces, ambient pulses, anything that loops with no work behind it. Nothing moves by being
laid out again: a mark on a track is moved (`translate`), and the tracks sit above the runs, where nothing that
arrives can push them.

Tried and dropped: the slope picture moving into the comparison when the first task is sent. It blended a small
picture into a wide block of text, two unlike things, and explained nothing.

### Reduced motion

With the system's setting, nothing moves: the CSS durations become 0, the changes of page are made at once, the
tracks and their gates are simply where they stand, and the spinner is a still icon. The right password opens the
app without the wait for the padlock.

## Voice

One idea: **every task is a run down the same course.** Two agents start together and the app keeps the times. The app
already called it a "run"; the voice takes that word seriously, lightly, the way a friend on the ski lift would.

| Trait        | It means                                                  | It does not mean                       |
| ------------ | --------------------------------------------------------- | -------------------------------------- |
| Brief        | Titles of six words or fewer, the verb first              | Cryptic, or dropping what a user needs |
| Good company | One light touch per screen; on your side when a run fails | Puns everywhere, or a joke in an error |
| Fair         | Says what happened; has no favourite agent                | Cold, or silent                        |

- A run is **running**, then **finished**, **incomplete** (it stopped cleanly without doing its task), **did not
  finish** or was **stopped**. Only a duration is ever called
  "fastest": never "race", "winner" or "loser". The steps inside a run (tool calls) keep plain words: running,
  done, failed.
- A mountain word is kept only if the sentence is clear to someone who has never skied. Left out after
  testing with a reader who never skied: fresh snow, on the course, out of the gate, piste, powder.
- The two pages with no content keep the theme in their title and say the plain fact beside it: a missing page is
  "Off the marked runs." then "This page is not on the map."; a failure on our side is "The lift is stopped." then
  "Something broke on our side." The password page follows them: "The ski locker is locked." then "This app is
  private. Enter its password to start a run."
- Numbers, errors and code stay plain. The reason a run did not finish is the agent's own words, never rewritten. One exception: when a provider
  refused the app itself (a key it does not know, no credit left, a quota used up), the visitor is told that it is a
  problem with the app, not with their task; the provider's words go to the server's log.

## Layout

In code: `packages/ui/src/styles.css` (the Tailwind configuration: `@theme` and the `page-frame` / `page-grid`
utilities) and the check `tooling/layout-scale.test.ts`.

### Spacing: one scale, two kinds

| Step (Tailwind) | px  | Used for                                                           |
| --------------- | --- | ------------------------------------------------------------------ |
| `1`             | 4   | a label and its value; an icon and a count                         |
| `2`             | 8   | items of one group (buttons side by side, a title and its line)    |
| `3`             | 12  | groups inside a card; fields of a toolbar                          |
| `4`             | 16  | inside a card (padding); the phone gutter                          |
| `6`             | 24  | between cards and sections; the column gap; the gutter from 640 px |
| `8`             | 32  | between the page header and the page's content                     |
| `12`            | 48  | rare: before the end of a page                                     |

**Layout spacing** (gaps, margins, and padding of 12 px or more: sections, cards, rows) uses only these steps in our
own components and in `apps/web`; `tooling/layout-scale.test.ts` fails on any other value. **Control spacing** is
padding under 12 px, inside a button, badge, input or menu item: it belongs to the control and keeps its own sizes,
as do the library primitives in `packages/ui/src/components/ui` (what shadcn and AI Elements generate). Not spacing
either: a 2 px margin aligning an icon with the first line of its text (`mt-0.5`), and a value marked with a
`layout-scale: <why>` comment just above it.

### The page frame

One container for the header and the content, the `page-frame` utility: `max-w-7xl` (1280 px), centred, gutter
**16 px below 640 px, 24 px from 640 px**.

### The column grid

| Width       | Columns | Gap   |
| ----------- | ------- | ----- |
| < 640 px    | 4       | 16 px |
| 640–1023 px | 8       | 24 px |
| ≥ 1024 px   | 12      | 24 px |

The `page-grid` utility. It reads the width its container gives it, not the window's (`@container` on an ancestor),
so the columns change at a content width of 592 px (`@cols-8:`, 37rem) and 976 px (`@cols-12:`, 61rem). Areas span
columns (`col-span-full @cols-12:col-span-6`); a component does not invent its own column widths for page structure.

Components size on the space they are given (`@container`), not on the screen width: a run's column is narrow on a
wide screen. Screen-width breakpoints (`sm:`, `md:`, `lg:`) stay for the page frame.
