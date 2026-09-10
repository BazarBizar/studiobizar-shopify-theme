import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function DesignerLoading() {
  return (
    <Container className="pt-12 pb-section">
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
        <Skeleton className="aspect-[619/728] w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-[14rem]" />
          <Skeleton className="h-5 w-[18rem]" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </Container>
  );
}
