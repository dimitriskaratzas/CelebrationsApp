# Design Handoff — Celebrations (Θέμα & Οθόνες)

**Date:** May 2026  
**Fidelity:** High-fidelity  
**Target stack:** React Native / Expo Router / TypeScript  
**Active theme:** Aegean Noon (primary), Sunset Blur (alternate)

> The HTML files in this package are **design references built as browser prototypes** — they use web CSS and React (DOM). They are NOT production code. Your job is to recreate the screens in React Native using `StyleSheet`, `react-native-reanimated`, and the existing Expo Router project structure, following the token values in `theme.ts`.

---

## Files in this package

| File | Purpose |
|---|---|
| `theme.ts` | Drop into `mobile/src/ui/theme.ts`. All color, radius, spacing, typography tokens. |
| `fonts.md` | Expo Google Fonts install + load instructions for Plus Jakarta Sans + Manrope. |
| `Celebrations.html` | Full interactive prototype — Today, Calendar, Contacts, Settings, Wish sheet, Add sheet. |
| `Celebrations Modern.html` | Theme exploration canvas — Aegean Noon vs. Sunset Blur vs. Horizon vs. Bougainvillea Night. |

---

## Design tokens quick reference

See `theme.ts` for the full token map. Key values for Aegean Noon:

```ts
// Colors
accent:       '#0F4C81'   // Hellenic cobalt — buttons, active states
heroAccent:   '#FFC93C'   // Amber — hero number, "Στείλε" pill
surface:      '#FFFFFF'
surface2:     '#DDE9F2'
ink:          '#0E2238'
muted:        '#5C7390'
line:         'rgba(15, 76, 129, 0.10)'

// Radii
card:         20
hero:         24
chip:         99 (pill)
sheet:        28 (bottom sheets)

// Screen horizontal padding
screen:       22

// Typography
display:      PlusJakartaSans_700Bold  (titles, dates)
body:         Manrope_600SemiBold      (list items, captions)
```

---

## Screens

### 1. Today (`app/(tabs)/today.tsx`)

**Layout** (top → bottom, all inside a `ScrollView`):

```
StatusBar offset (56px)
  Header row (paddingH: 22)
    - "ΣΑΒΒΑΤΟ" — Manrope 700, 12px, letterSpacing 1.6, uppercase, color: accent
    - "16 Μαΐου" — PlusJakartaSans 700, 34px, color: ink, whiteSpace nowrap
    - [+] icon button (40×40, borderRadius 12, bg: surface2)

  Hero card (margin: 20 22 14, padding: 22)
    - Background: LinearGradient 180° heroBgTop→heroBgBottom
    - borderRadius: 24, shadow: card
    - Large count: PlusJakartaSans 800, 80px, color: heroAccent
    - "ΣΗΜΕΡΑ ΓΙΟΡΤΑΖΟΥΝ" pill: inline-flex, bg rgba(255,255,255,0.22),
      borderRadius 99, fontSize 11, fontWeight 700, letterSpacing 1, uppercase
    - Celebrant rows (one per favorite celebrating today):
        Avatar (44px) | Name (15px bold) + saint/type (12px) | "Στείλε →" pill

  "Επόμενες" section header (paddingH: 22) + sea-wave divider
  Upcoming rows (paddingH: 22, gap: 10):
    [Date chip 50×56] | [Name + type chip + relative date] | [›]
```

**Celebrant row (inside hero card):**
```
bg: rgba(255,255,255,0.18), border: rgba(255,255,255,0.22), borderRadius: 18, padding: 10 12
Avatar 40px | Name 15 700 white / subtext 12 rgba(255,255,255,0.82) | "Στείλε →" pill (bg: heroAccent, color: heroAccentInk)
```

**Upcoming row:**
```
bg: surface, borderRadius: 20, padding: 12 14, border: line
Date chip (50×56, bg: surface2 or accent-if-today, borderRadius: 16):
  - MONTH: Manrope 700 10px uppercase opacity 0.75
  - DAY: PlusJakartaSans 700 22px
Name: Manrope 700 15px ink | Surname: Manrope 500 15px muted
Type chip + relativeDay
Chevron right: muted
```

---

### 2. Calendar (`app/(tabs)/calendar.tsx`)

**Layout:**
```
Title "Ημερολόγιο" — PlusJakartaSans 700 34px

Month switcher row: [‹] ΜΗΝΑΣ ΧΧΧΧ [›] — PlusJakartaSans 700 22px

Month grid card (bg: surface, borderRadius: 20, padding: 14 12):
  Weekday headers: Manrope 700 11px uppercase muted, grid 7 cols
  Day cells: 7-col grid
    - Today: border 1.5px accent-gold, color: gold, fontWeight 700
    - Selected: bg accent, color white, fontWeight 700
    - Has celebrations: dot(s) below number (gold=nameday, accent=birthday)
  Legend: gold dot = Ονομαστική | accent dot = Γενέθλια

Selected-day list: same Upcoming rows as Today screen
```

**Day cell size:** `(screenWidth - 44 - 24) / 7` ≈ 44px square, aspectRatio 1:1, borderRadius 12.

---

### 3. Favorites / Contacts (`app/(tabs)/contacts.tsx`)

**Layout:**
```
Header row: Title + [+] button

Free-tier meter card (bg: surface, borderRadius: 20, padding: 14 16):
  "X / 15 αγαπημένα" Manrope 700 13px | Premium teaser Manrope 600 12px gold
  Progress bar: height 6, bg surface2, fill: linearGradient gold

Search bar (bg: surface, borderRadius: 14, padding: 10 14):
  search icon 16px muted | Manrope 14px placeholder

Favorites list (gap: 10):
  Avatar 44px + gold ring if nameday | Name + rel + note | Date + relative label
```

**Favorite row:**
```
bg: surface, borderRadius: 20, padding: 12 14
Avatar (44px, gold ring if nameday) | displayName 15 700 + relationship 12 muted | dateShort + relativeDay
```

---

### 4. Wish Sheet (modal — `app/wish/[id].tsx`)

**Bottom sheet** — `react-native-reanimated` + `@gorhom/bottom-sheet` recommended.  
Height: 760px. `borderTopLeftRadius: 28, borderTopRightRadius: 28`.

**Layout (top → bottom):**
```
Handle pill (38×4, bg rgba(0,0,0,0.18))

Header (padding: 4 20 18, border-bottom):
  Avatar 52px + gold ring | Name PlusJakartaSans 700 24px | Saint + Date + Relationship | [✕]

Tone selector row (3 equal buttons):
  "Χαλαρό" | "Επίσημο" | "Αστείο"
  Active: bg accent, color white | Inactive: bg surface, border line

Wish card (bg: white, borderRadius: 20, padding: 22, border gold 55%):
  Big " watermark (PlusJakartaSans, 96px, gold 40% opacity, absolute)
  Wish text: PlusJakartaSans 500 18px lineHeight 26px
  Action row: [Επεξεργασία] [Άλλη] — ghost buttons

Alt wish pills (2 remaining options)

Share bar (border-top):
  [WhatsApp] [SMS] [Αντιγραφή] [Άλλο] — icon + label in columns
```

---

### 5. Add Favorite Sheet (3-step modal)

**Bottom sheet** height: 620px.  
3-step flow with a dot progress indicator at the bottom.

```
Step 0: Name input
  - Full-width input, fontFamily PlusJakartaSans, fontSize 18
  - Greeklish suggestion chip if name is recognized

Step 1: Kind + Date
  - Two cards: [Ονομαστική] [Γενέθλια] — selected has gold border + shadow
  - Date display row below

Step 2: Relationship
  - 2×2 grid of cards: Οικογένεια / Φίλος / Αγάπη / Συνάδελφος
  - Each has icon (34×34 bg surface2) + label
  - Selected: white bg, gold border, gold box-shadow

Bottom bar: dot progress (3 dots — active expands 22px wide) + "Συνέχεια" CTA
```

---

### 6. Settings (`app/(tabs)/settings.tsx`)

```
Title "Ρυθμίσεις" PlusJakartaSans 700 34px

Premium card (bg: dark #1f1305→#2b1c0a, border gold55%, borderRadius 20):
  "Celebrations Premium" gold uppercase label
  Headline PlusJakartaSans 700 26px white
  3 pricing tiles: Μηνιαίο 1.99€ | Ετήσιο 9.99€ (highlighted gold) | Εφάπαξ 19.99€

Settings groups (bg: surface, borderRadius: 20, divide by line):
  Icon (34×34, bg surface2, borderRadius 10) | Title + subtitle | Value/chevron
  Toggle row: standard iOS-style toggle switch
```

---

## Interactions & Animations

| Interaction | Spec |
|---|---|
| Tab switch | Instant (no shared-element) — active tab background fades in `duration: 200ms` |
| Bottom sheet open | Spring — `damping: 18, stiffness: 200` (react-native-reanimated) |
| "Στείλε" sent toast | Slide up from bottom-center, opacity 0→1, `duration: 300ms ease-out`, auto-dismiss 2.5s |
| Upcoming row press | Scale 0.98 on pressIn, back on pressOut — `react-native-reanimated` `useAnimatedStyle` |
| Wish tone switch | Content cross-fade `duration: 150ms` |
| Progress bar fill | Animated width change `duration: 300ms ease` |
| Toggle switch | Thumb slides left/right `duration: 200ms ease` |
| Calendar day select | Background fills `duration: 120ms` |

---

## Tab bar

**Absolute position** at bottom, inset `12px` left/right, `18px` from bottom.  
`borderRadius: 28`, `padding: 8`.  
**Background:** `rgba(255,255,255,0.78)` + `BlurView` (Expo blur) intensity 80.  
**Border:** `1px rgba(40,30,20,0.08)`.  
**Shadow:** see `shadow.tabBar` in `theme.ts`.

Tab active state: fill `accent` (#0F4C81), icon color `heroAccent` (#FFC93C), label `#FBF6E8`.  
Tab inactive: transparent bg, icon + label color `muted`.

---

## Avatar component

```tsx
// Avatar — coloured monogram circle.
// Ring (gold, 2px, inset -3px) on nameday-type favorites.
// Colours are deterministic from name hash — see hashName() in theme.ts or replicate with:
const AVATAR_COLORS = [
  ['#C9A961','#8E6E2A'], // gold
  ['#3F6BAA','#1F3D6E'], // aegean
  ['#C26A4A','#7E3E25'], // terracotta
  ['#6F8E5F','#3F5836'], // olive
  ['#B6588E','#7A2F5A'], // hibiscus
  ['#5C8FA3','#34616F'], // sea
  ['#A87049','#6C4226'], // cinnamon
];
// hashName(name) % 7 → pick gradient pair
```

---

## Notes for implementation

1. **BlurView (Sunset Blur theme):** `expo-blur` `BlurView` with `intensity={80}` and `tint="light"` over a semi-transparent white card background. Falls back to plain `rgba(255,255,255,0.65)` on Android (Android blur support is limited).

2. **LinearGradient:** Use `expo-linear-gradient` for hero cards and screen backgrounds.

3. **Sea-wave divider:** A thin SVG-like line using `react-native-svg` `Path` under section headers in Aegean Noon:
   ```
   d="M0 6 Q 12.5 1, 25 6 T 50 6 T 75 6 T 100 6 T 125 6 ..."
   stroke: accent, strokeWidth: 1.4, opacity: 0.35
   ```

4. **Preset wishes:** Ship as `src/data/wishes-presets.json`. The prototype has 3 variants × 3 tones × 4 relationships = 36 strings. Expand to the target 50+ in the real app.

5. **Greeklish name matching:** The prototype's simple lookup table is intentional for the prototype — replace with the full `greeklish.ts` mapping + Levenshtein ≤ 2 in production.

6. **Bottom sheets:** The prototype uses CSS transforms. In React Native, use `@gorhom/bottom-sheet` with `snapPoints={['92%']}` for the Wish sheet and `snapPoints={['75%']}` for the Add sheet.
