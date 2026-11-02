import type { ReactNode } from "react";

// Pantallas sin sesión (ingresar, recuperar, nueva clave): centradas, sin marco.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
