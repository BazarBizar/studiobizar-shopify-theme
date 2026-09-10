import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function DesignersLoading() {
  return (
    <Container className="pt-12 pb-section">
      <Skeleton className="h-9 w-[16rem]" />
      <ul className="sb-grid-4 mt-12 gap-y-12">
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-card w-full" />
            <Skeleton className="h-4 w-2/3" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
