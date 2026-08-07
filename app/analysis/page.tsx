import { Suspense } from "react";
import { AnalysisPage } from "@/components/analysis-page";

export default function AnalysisRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <AnalysisPage />
    </Suspense>
  );
}
