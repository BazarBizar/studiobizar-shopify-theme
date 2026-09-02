import { Container } from "@/components/ui/container";
import { ProductCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CollectionLoading() {
  return (
    <>
      <Skeleton className="h-[32rem] w-full lg:h-[44rem]" />
      <Container className="py-section">
        <Skeleton className="h-9 w-[20rem]" />
        <ul className="sb-grid-4 mt-12">
          {Array.from({ length: 8 }).map((_, index) => (
            <li key={index}>
              <ProductCardSkeleton />
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
