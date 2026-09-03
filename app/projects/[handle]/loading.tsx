import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <>
      <Skeleton className="aspect-[2/3] w-full sm:aspect-[16/10] lg:aspect-[16/8]" />
      <Container className="py-section">
        <Skeleton className="h-9 w-[20rem]" />
        <Skeleton className="mt-4 h-6 w-[26rem]" />
        <div className="mt-14 grid gap-12 lg:grid-cols-[20rem_1fr] lg:gap-20">
          <div className="flex flex-col gap-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
