import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Uneven heights, because the real grid is masonry. */
const HEIGHTS = ["h-[24rem]", "h-[18rem]", "h-[30rem]", "h-[20rem]", "h-[28rem]", "h-[22rem]"];

export default function GalleryLoading() {
  return (
    <Container className="pt-12 pb-section">
      <Skeleton className="h-9 w-[10rem]" />
      <div className="mt-12 grid gap-grid-gap sm:grid-cols-2 lg:grid-cols-3">
        {HEIGHTS.map((height, index) => (
          <Skeleton key={index} className={`w-full ${height}`} />
        ))}
      </div>
    </Container>
  );
}
