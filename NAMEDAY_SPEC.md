# Ονομαστική — Claude Code Project Spec

## 🎯 Product Vision

Ελληνική mobile app (Android + iOS) που λύνει ένα καθημερινό πρόβλημα: να θυμάσαι ποιος γιορτάζει και να στέλνεις αυθεντικές, προσωπικές ευχές με ένα tap.

Στόχος: η πρώτη ελληνική "social celebration app" — όχι απλά εορτολόγιο.

---

## 🏗️ Tech Stack

- **Framework:** React Native (Expo managed workflow)
- **Navigation:** React Navigation v6
- **State:** Zustand
- **Local DB:** expo-sqlite
- **Notifications:** expo-notifications (local only, no server)
- **Contacts:** expo-contacts (with graceful fallback αν ο user αρνηθεί)
- **AI ευχές:** Fetch calls σε δικό μας ASP.NET Core proxy API (ποτέ direct Anthropic key στο app)
- **Payments:** react-native-purchases (RevenueCat) για Google Play / App Store billing
- **Analytics:** @react-native-firebase/analytics + crashlytics
- **Backend:** ASP.NET Core minimal API σε Render (μόνο AI proxy + purchase validation)
- **CI/CD:** EAS Build (Expo Application Services)

---

## 📁 Project Structure

```
greek-nameday-celebrations/
├── app/                        # Expo Router screens
│   ├── (tabs)/
│   │   ├── today.tsx           # Ποιος γιορτάζει σήμερα
│   │   ├── calendar.tsx        # Μηνιαίο ημερολόγιο γιορτών
│   │   ├── contacts.tsx        # Οι επαφές μου με γιορτές
│   │   └── settings.tsx        # Ρυθμίσεις
│   └── wish/[id].tsx           # AI ευχή screen
├── src/
│   ├── data/
│   │   ├── namedays.ts         # Πλήρης βάση ελληνικών ονομάτων (static)
│   │   └── movable-feasts.ts   # Λογική για κινητές εορτές (Πάσχα κτλ)
│   ├── services/
│   │   ├── contacts.service.ts # Sync + on-device matching
│   │   ├── wishes.service.ts   # AI ευχές via proxy
│   │   ├── notifications.ts    # Scheduling local notifications
│   │   └── purchases.ts        # RevenueCat wrapper
│   ├── store/
│   │   ├── favorites.store.ts  # Αγαπημένα (χωρίς contacts permission)
│   │   └── settings.store.ts   # User preferences
│   ├── components/
│   │   ├── NamedayCard.tsx
│   │   ├── WishBubble.tsx
│   │   ├── ContactRow.tsx
│   │   └── PremiumBadge.tsx
│   └── utils/
│       ├── greeklish.ts        # Giorgos → Γιώργος normalization
│       └── movable-feasts.ts   # Υπολογισμός κινητών εορτών (Πάσχα, Πεντηκοστή κτλ)
├── backend/                    # ASP.NET Core minimal API
│   ├── Program.cs
│   ├── WishesEndpoint.cs       # POST /api/wishes
│   └── appsettings.json
└── CLAUDE.md                   # (αυτό το αρχείο για Claude Code)
```

---

## 🗃️ Data Model

### namedays.ts (static, bundled στο app)
```typescript
interface NameDay {
  names: string[];          // ["Γιώργος", "Γεώργιος", "Georgia", "Giorgos"]
  month: number;            // 1-12
  day: number;              // 1-31
  isMovable?: boolean;      // true για κινητές γιορτές
  movableKey?: string;      // "easter+1" | "easter-7" | "pentecost" κτλ
  saint?: string;           // "Άγιος Γεώργιος"
}
```

### SQLite Tables
```sql
-- Αγαπημένοι (χωρίς contacts permission)
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  name_day_key TEXT NOT NULL,    -- "04-23" ή "movable:easter+0"
  relationship TEXT,             -- "friend" | "family" | "colleague" | "partner"
  contact_id TEXT,               -- nullable, αν έχουμε contacts access
  custom_override_month INTEGER, -- αν ο user overrides τη γιορτή
  custom_override_day INTEGER,
  created_at INTEGER NOT NULL
);

-- Cache AI ευχών (για να μην ξανακαλούμε)
CREATE TABLE wish_cache (
  id TEXT PRIMARY KEY,
  relationship TEXT NOT NULL,
  tone TEXT NOT NULL,            -- "formal" | "casual" | "funny"
  recipient_name TEXT NOT NULL,
  wish_text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Ιστορικό αποστολής
CREATE TABLE sent_wishes (
  id TEXT PRIMARY KEY,
  favorite_id TEXT NOT NULL,
  wish_text TEXT NOT NULL,
  sent_via TEXT,                 -- "whatsapp" | "viber" | "sms" | "copy"
  sent_at INTEGER NOT NULL
);
```

---

## 🤖 AI Wishes — Backend Endpoint

### POST /api/wishes
**Request:**
```json
{
  "recipientName": "Γιώργο",
  "relationship": "friend",
  "tone": "casual",
  "senderName": "Δημήτρης"
}
```

**System Prompt (Claude Haiku):**
```
Είσαι ειδικός στο να γράφεις αυθεντικές ελληνικές ευχές για ονομαστικές εορτές.

Κανόνες:
- Γράφε ΠΑΝΤΑ στα ελληνικά
- Ύφος ανάλογα με το relationship:
  * friend: casual, ζεστό, μπορεί να έχει ελαφρύ χιούμορ
  * family: ζεστό, τρυφερό, από καρδιάς  
  * colleague: επαγγελματικό αλλά φιλικό, όχι κρύο
  * partner: ρομαντικό, προσωπικό, τρυφερό
  * grandparent: με σεβασμό, ζεστό, παραδοσιακό
- Tone modifier:
  * formal: πιο επίσημο ύφος
  * casual: καθημερινό, σαν να μιλάς
  * funny: με χιούμορ, αστείο αλλά με αγάπη
- Μήκος: 2-4 προτάσεις, όχι παραπάνω
- ΜΗΝ αρχίζεις με "Χρόνια Πολλά" — αυτό λένε ΟΛΟΙ, να είσαι πρωτότυπος
- Μπορείς να κλείσεις με "Χρόνια Πολλά" αλλά όχι να ανοίξεις
- Η ευχή πρέπει να ακούγεται σαν να τη λέει ένας πραγματικός άνθρωπος, όχι AI
- Χρησιμοποίησε το όνομα του παραλήπτη στην κλητική (Γιώργο, Μαρία, Κώστα κτλ)
```

**Response:**
```json
{
  "wishes": [
    "Γιώργο μου, σήμερα είναι η μέρα σου! Να είσαι πάντα υγιής...",
    "Εύχομαι η σημερινή σου μέρα να είναι...",
    "Χρόνια Πολλά Γιώργο! Να σε έχουμε πάντα..."
  ]
}
```

Επέστρεφε **πάντα 3 εναλλακτικές** για να διαλέξει ο user.

---

## 📱 Key Screens

### 1. Today Tab
- Header: "Σήμερα γιορτάζουν X άτομα"
- List από NamedayCards (φωτογραφία επαφής αν υπάρχει, αλλιώς initials avatar)
- Tap → Wish screen
- Empty state: "Κανείς δεν γιορτάζει σήμερα — αλλά σε 3 μέρες γιορτάζει ο Κώστας"

### 2. Wish Screen  
- Recipient info up top
- Relationship selector (tabs: Φίλος / Οικογένεια / Συνάδελφος / Αγάπη)
- Tone slider: Επίσημο ←→ Χαλαρό ←→ Αστείο
- "Δημιούργησε Ευχή" button → loading → 3 wish options
- Tap wish → edit inline αν θέλει ο user
- Share bar: WhatsApp | Viber | SMS | Αντιγραφή
- Premium upsell αν έχει εξαντλήσει τις δωρεάν ευχές

### 3. Calendar Tab
- Μηνιαίο view με dots στις ημέρες που γιορτάζει κάποιος
- Tap ημέρα → mini list από names
- Αναζήτηση ονόματος (greeklish-aware)

### 4. Contacts Tab
- Requires permission — αν δεν υπάρχει, prompt με εξήγηση
- List επαφών ταιριαστών με εορτολόγιο
- Ability να overrides τη γιορτή χειροκίνητα
- "Πρόσθεσε χειροκίνητα" για αγαπημένους χωρίς contacts access

### 5. Settings
- Notification preferences (ώρα reminder, πόσες μέρες πριν)
- Premium status / manage subscription
- Privacy info (τι δεδομένα μένουν στη συσκευή)
- "Για την εφαρμογή"

---

## 🔔 Notifications Logic

```typescript
// Scheduling γίνεται ΤΟΠΙΚΑ με expo-notifications
// Τρέχει κάθε φορά που ανοίγει η app + κάθε 1η του μήνα

async function scheduleMonthlyReminders(favorites: Favorite[]) {
  await cancelAllScheduledNotifications();
  
  for (const fav of favorites) {
    const nameday = resolveNameday(fav); // handles movable feasts    
    // Reminder 3 μέρες πριν
    scheduleNotification({
      title: `🎉 Σε 3 μέρες γιορτάζει ο/η ${fav.displayName}`,
      body: "Έτοιμες οι ευχές σου;",
      trigger: subDays(nameday, 3),
    });
    
    // Πρωί της γιορτής
    scheduleNotification({
      title: `🎊 Σήμερα γιορτάζει ο/η ${fav.displayName}!`,
      body: "Στείλε ευχές με ένα tap →",
      trigger: { ...nameday, hour: 9, minute: 0 },
    });
  }
}
```

---

## 💰 Freemium Logic

```typescript
const FREE_WISHES_PER_MONTH = 5;

// Αποθηκεύεται τοπικά + validate με RevenueCat
interface UserEntitlement {
  isPremium: boolean;
  wishesUsedThisMonth: number;
  wishesResetDate: Date;
}

// Τιμολόγηση (Google Play / App Store)
const PRODUCTS = {
  monthly: "onomastiki_premium_monthly",  // 1.99€/μήνα
  yearly: "onomastiki_premium_yearly",    // 9.99€/χρόνο  
  lifetime: "onomastiki_lifetime",        // 19.99€ εφάπαξ
};
```

---

## 🌐 Greeklish Normalization

```typescript
// Παραδείγματα που πρέπει να δουλεύουν:
// "Giorgos" → "Γιώργος" ✓
// "Kwstas" → "Κώστας" ✓  
// "Maria" → "Μαρία" ✓
// "Nikos" → "Νίκος" ✓
// "Eleni" → "Ελένη" ✓
// "Thanasis" → "Θανάσης" ✓

// Χρησιμοποίησε βιβλιοθήκη greeklish ή custom mapping table
// Κάνε fuzzy match με Levenshtein distance ≤ 2 για typos
```

---

## 🚀 Phase 1 Deliverables (MVP)

- [ ] Πλήρης εορτολόγιο engine (static data, κινητές γιορτές)
- [ ] Favorites list χωρίς contacts permission
- [ ] Contacts sync με on-device matching
- [ ] AI ευχές via proxy (3 εναλλακτικές)
- [ ] Share σε WhatsApp/Viber/SMS
- [ ] Local notifications (3 μέρες πριν + ημέρα)
- [ ] Freemium gate (5 δωρεάν/μήνα)
- [ ] RevenueCat integration
- [ ] Greek UI strings παντού

## 🚫 Out of scope για Phase 1

- Gift suggestions / affiliate
- E-cards με γραφικά
- Backend για user accounts
- Social features
- iPad / tablet layout
- iOS widget (Phase 2)

---

## ⚠️ Σημαντικές αρχές

1. **Privacy-first:** Τα contacts δεν φεύγουν ποτέ από τη συσκευή. Το AI call στέλνει μόνο `recipientName` (όχι τηλέφωνο/email).
2. **Offline-first:** Το εορτολόγιο και τα favorites δουλεύουν πάντα offline. Μόνο AI ευχές χρειάζονται internet.
3. **Greek-first UX:** Όλα τα strings στα ελληνικά. Καμία αγγλική λέξη στο UI.
4. **Performance:** Instant load για today screen — χωρίς loading spinners για βασικές λειτουργίες.
5. **Battery friendly:** Τα notifications είναι local — κανένα background sync.
