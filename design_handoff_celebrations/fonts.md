# Font Setup — Celebrations

Two typefaces are used across both themes. Both are available via `@expo-google-fonts`.

---

## 1. Plus Jakarta Sans — Display / Headings

Used for: screen titles ("16 Μαΐου"), large hero numbers, section headers, date chips.

### Install

```bash
npx expo install @expo-google-fonts/plus-jakarta-sans expo-font
```

### Load in `app/_layout.tsx`

```tsx
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { SplashScreen } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  return <Slot />;
}
```

### Weights used in design

| Token key                     | Weight | Use case                        |
|-------------------------------|--------|---------------------------------|
| `PlusJakartaSans_700Bold`     | 700    | Titles, section headers         |
| `PlusJakartaSans_800ExtraBold`| 800    | Hero count number               |

---

## 2. Manrope — Body / UI

Used for: list item names, chips, captions, labels, tab bar, button text.

### Install

```bash
npx expo install @expo-google-fonts/manrope
```

### Weights used in design

| Token key              | Weight | Use case                              |
|------------------------|--------|---------------------------------------|
| `Manrope_500Medium`    | 500    | Secondary text, secondary names       |
| `Manrope_600SemiBold`  | 600    | Default body weight                   |
| `Manrope_700Bold`      | 700    | Primary names, chip labels, captions  |
| `Manrope_800ExtraBold` | 800    | Pill CTAs ("Στείλε →"), tab active    |

---

## Greek glyph coverage

Both Plus Jakarta Sans and Manrope have full Greek Unicode coverage — no substitution needed for Greek text.
