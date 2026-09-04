import { Container } from "@/components/ui/container";
import { ProductCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ShopLoading() {
  return (
    <Container className="pt-12 pb-section">
      <Skeleton className="h-9 w-[12rem]" />
      <Skeleton className="mt-6 h-4 w-full max-w-[40rem]" />

      <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-28" />
        ))}
      </div>

      <ul className="sb-grid-4 mt-10">
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    </Container>
  );
}
