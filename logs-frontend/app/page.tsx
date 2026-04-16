import { Suspense } from "react";
import { Shell } from "@/components/app/shell";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Shell />
    </Suspense>
  );
}
