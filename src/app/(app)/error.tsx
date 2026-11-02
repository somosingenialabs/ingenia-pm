"use client";

import { ErrorDePantalla } from "@/components/estado/error-de-pantalla";

export default function AppError(props: { error: unknown; retry: () => void }) {
  return <ErrorDePantalla {...props} />;
}
