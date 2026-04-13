import { Suspense } from "react";
import { Entry } from "./components/entry";

export default function CustomerReportPage() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
