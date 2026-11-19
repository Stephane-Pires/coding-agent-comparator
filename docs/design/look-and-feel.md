# Look and feel

Applies to every page and component of the web app, which are built from `packages/ui`. Change these rules here first,
then in code.

## Colour

Black or white (following the system's light or dark setting; there is no switch in the app) with one pink, a
magenta (hue 345). **Pink has one job: what you can act on, and where you are.**

| Role                                | Token                        | Light                                   | Dark                                     |
| ----------------------------------- | ---------------------------- | --------------------------------------- | ---------------------------------------- |
| The main action (Send): a pink fill | `--primary`                  | `oklch(0.56 0.2 345)`, white text 5.2:1 | `oklch(0.76 0.15 345)`, black text 8.6:1 |
| Pink as text: links                 | `--brand` (`text-brand`)     | `oklch(0.53 0.2 345)`, 5.9:1            | `oklch(0.8 0.12 345)`, 10:1              |
| Where you are: a selected item      | `--selected` (`bg-selected`) | `oklch(0.965 0.018 345)`                | `oklch(0.27 0.06 345)`                   |
| Keyboard focus                      | `--ring`                     | `oklch(0.62 0.19 345)`, 4:1             | `oklch(0.72 0.16 345)`, 7.4:1            |

Everything else stays black, white and greys, with two tones for the state of a run:

| State of a run | Tone                  | Also shown by                |
| -------------- | --------------------- | ---------------------------- |
| Running        | grey                  | its icon and the word        |
| Succeeded      | green (`--success`)   | its icon and the word        |
| Failed         | red (`--destructive`) | its icon, the word, a reason |
| Cancelled      | grey                  | its icon and the word        |

One stated exception: **what a command printed is shown as a terminal**, light text on a near-black panel in both
themes, with the colours the command itself used. It is the command's output, not the app's palette.

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

Motion only shows the result of something the user just did, so they can follow where it went.

| Duration                             | For                             |
| ------------------------------------ | ------------------------------- |
| 120 ms (`--duration-fast`)           | colour changes: hover and press |
| 180 ms (`--duration-base`, ease-in)  | something leaving               |
| 240 ms (`--duration-slow`, ease-out) | something moving                |

Dialogs and menus keep their library's short defaults. Never: on page load, numbers counting up, bounces, ambient
pulses, anything that delays a click.

One stated exception: **a run in progress shows a spinner**, and text appears as the agent writes it. Both report
work that is happening now; neither is decoration. With the system's reduced-motion setting nothing moves (the CSS
durations become 0) and the spinner stays as a still icon.

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
