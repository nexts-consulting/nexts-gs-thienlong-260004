import { Suspense } from "react";
import { Entry } from "./components/entry";

export default function ReportPage() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
