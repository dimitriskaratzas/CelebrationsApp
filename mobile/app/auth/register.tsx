import { ComingSoonScreen } from '@/features/auth/components/ComingSoonScreen';

export default function RegisterStub() {
  return (
    <ComingSoonScreen
      icon="person-add-outline"
      eyebrow="ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ"
      title="Κράτησε τα αγαπημένα σου ασφαλή."
      lede="Στη Φάση 4 θα μπορείς να κάνεις claim τον ανώνυμο λογαριασμό σου — οι γιορτές που έχεις προσθέσει μένουν, αλλά αποκτούν email & κωδικό."
      bullets={[
        'Διατήρηση δεδομένων από τη δοκιμή',
        'Σύνδεση από κινητό, tablet, web',
        'Premium για απεριόριστα αγαπημένα',
      ]}
    />
  );
}
