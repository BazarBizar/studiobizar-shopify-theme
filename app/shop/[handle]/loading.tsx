import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <Container className="pt-8 pb-section">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="aspect-card w-full" />

        <div className="max-w-[35rem]">
          <Skeleton className="h-3 w-[12rem]" />
          <Skeleton className="mt-4 h-9 w-[18rem]" />
          <Skeleton className="mt-3 h-6 w-[14rem]" />

          <div className="mt-8 flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>

          <Skeleton className="mt-12 h-12 w-full max-w-[28rem]" />
        </div>
      </div>
    </Container>
  );
}
