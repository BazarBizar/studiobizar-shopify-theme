import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function CollectionsLoading() {
  return (
    <Container className="pt-12 pb-section">
      <Skeleton className="h-9 w-[14rem]" />
      <Skeleton className="mt-6 h-4 w-full max-w-[40rem]" />
      <ul className="sb-grid-4 mt-12">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/2] w-full sm:aspect-[3/5]" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
