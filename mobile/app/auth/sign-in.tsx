import { ComingSoonScreen } from '@/features/auth/components/ComingSoonScreen';

export default function SignInStub() {
  return (
    <ComingSoonScreen
      icon="log-in-outline"
      eyebrow="ΣΥΝΔΕΣΗ"
      title="Καλωσήρθες πίσω."
      lede="Η σύνδεση με email θα είναι έτοιμη στη Φάση 4 — μαζί με τη συγχρονισμένη γιορτή σε όλες τις συσκευές σου."
      bullets={[
        'Σύνδεση με email & κωδικό',
        'Επαναφορά κωδικού',
        'Πολλαπλές συσκευές, ίδια αγαπημένα',
      ]}
    />
  );
}
