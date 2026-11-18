import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { signInWithGoogle, signOutOfAdmin } from "@/app/admin/actions";

// Shared building blocks for the admin sign-in pages: a single card with a
// title, a message, and server-action buttons. No client JavaScript.

export function AdminPanel({ titleId, title, tone = "default", children }) {
  return (
    <Section aria-labelledby={titleId} className="admin-section">
      <Container>
        <div className={`admin-panel admin-panel--${tone}`}>
          <h2 id={titleId} className="admin-panel__title">
            {title}
          </h2>
          {children}
        </div>
      </Container>
    </Section>
  );
}

export function GoogleSignInButton() {
  return (
    <form action={signInWithGoogle} className="admin-panel__action">
      <Button type="submit" variant="primary">
        เข้าสู่ระบบด้วย Google
      </Button>
    </form>
  );
}

export function SignOutButton({ label = "ออกจากระบบ" }) {
  return (
    <form action={signOutOfAdmin} className="admin-panel__action">
      <Button type="submit" variant="outline">
        {label}
      </Button>
    </form>
  );
}
