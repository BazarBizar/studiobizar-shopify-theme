import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <Container className="pt-12 pb-section">
      <Skeleton className="h-9 w-[12rem]" />
      <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-[7rem]" />
        ))}
      </div>
      <ul className="mt-10 grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/4] w-full sm:aspect-[2/3]" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
