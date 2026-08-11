import { Suspense } from "react";
import { DocumentPage } from "@/components/document-page";

export default function DocumentRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <DocumentPage />
    </Suspense>
  );
}
