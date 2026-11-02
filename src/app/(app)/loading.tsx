import { Loader2 } from "lucide-react";

// Shown instantly on navigation while the server fetches the next page.
export default function Loading() {
  return (
    <div className="flex justify-center py-32 text-neutral-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}
