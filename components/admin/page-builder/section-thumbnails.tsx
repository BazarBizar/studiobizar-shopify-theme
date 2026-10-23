import * as React from "react";

/**
 * A wireframe of each preset, for Add section — what the band LOOKS like, at a
 * glance, before it is added. Drawn rather than screenshotted: it costs no
 * request, follows the panel's light and dark theme, and cannot go stale when a
 * photograph on the live site changes.
 *
 * Keyed by preset id (`lib/page-builder/presets.ts`). A preset with no drawing
 * falls back to its section type's, then to a generic band.
 *
 * Everything is drawn on a 160 × 100 canvas from five shapes: an image, a
 * heading, a line of text, a button and a solid band.
 */

type Box = { x: number; y: number; w: number; h: number };
type Tone = "ink" | "paper";

const tone = (value: Tone | undefined) => (value === "paper" ? "fill-background" : "fill-current");

function Img({ x, y, w, h, solid }: Box & { solid?: boolean }) {
  const s = Math.min(w, h) * 0.28;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1} className={solid ? "fill-current opacity-60" : "fill-current opacity-[0.13]"} />
      {!solid && (
        <>
          <path
            d={`M${cx - s} ${cy + s * 0.6} L${cx - s * 0.2} ${cy - s * 0.35} L${cx + s * 0.2} ${cy + s * 0.15} L${cx + s * 0.5} ${cy - s * 0.1} L${cx + s} ${cy + s * 0.6} Z`}
            className="fill-current opacity-25"
          />
          <circle cx={cx + s * 0.55} cy={cy - s * 0.6} r={s * 0.17} className="fill-current opacity-25" />
        </>
      )}
    </g>
  );
}

/** A heading: a thick bar. */
const H = ({ x, y, w, h = 5, t }: { x: number; y: number; w: number; h?: number; t?: Tone }) => (
  <rect x={x} y={y} width={w} height={h} rx={1} className={`${tone(t)} opacity-80`} />
);

/** A line of text. */
const T = ({ x, y, w, t }: { x: number; y: number; w: number; t?: Tone }) => (
  <rect x={x} y={y} width={w} height={2.2} rx={1} className={`${tone(t)} opacity-35`} />
);

/** A few lines of text, the last one shorter. */
function Lines({ x, y, w, n = 3, gap = 4.5, t, center }: { x: number; y: number; w: number; n?: number; gap?: number; t?: Tone; center?: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, index) => {
        const width = index === n - 1 && n > 1 ? w * 0.65 : w;
        return <T key={index} x={center ? x + (w - width) / 2 : x} y={y + index * gap} w={width} t={t} />;
      })}
    </>
  );
}

function Btn({ x, y, w = 24, filled, t }: { x: number; y: number; w?: number; filled?: boolean; t?: Tone }) {
  return filled ? (
    <rect x={x} y={y} width={w} height={6} className={`${tone(t)} opacity-80`} />
  ) : (
    <rect
      x={x + 0.4}
      y={y + 0.4}
      width={w - 0.8}
      height={5.2}
      fill="none"
      strokeWidth={0.8}
      className={t === "paper" ? "stroke-background opacity-80" : "stroke-current opacity-70"}
    />
  );
}

const Band = ({ x = 0, y, w = 160, h, o = 0.85 }: { x?: number; y: number; w?: number; h: number; o?: number }) => (
  <rect x={x} y={y} width={w} height={h} className="fill-current" opacity={o} />
);

const Icon = ({ cx, cy }: { cx: number; cy: number }) => (
  <circle cx={cx} cy={cy} r={4.5} fill="none" strokeWidth={0.9} className="stroke-current opacity-60" />
);

/** A product card: picture and a name. */
const Card = ({ x, y, w, h }: Box) => (
  <>
    <Img x={x} y={y} w={w} h={h - 7} />
    <T x={x} y={y + h - 4} w={w * 0.7} />
  </>
);

const THUMBNAILS: Record<string, React.ReactNode> = {
  /* ---------------- Banners ---------------- */
  image_banner: (
    <>
      <Img x={0} y={0} w={160} h={100} />
      <T x={66} y={30} w={28} />
      <H x={40} y={37} w={80} h={6} />
      <Lines x={50} y={49} w={60} n={2} center />
      <Btn x={52} y={62} w={26} filled />
      <Btn x={82} y={62} w={26} />
    </>
  ),
  "image_banner.corner": (
    <>
      <Img x={0} y={0} w={160} h={100} />
      <H x={10} y={70} w={92} h={11} />
      <rect x={10} y={86} width={22} height={1} className="fill-current opacity-70" />
    </>
  ),
  "image_banner.panel": (
    <>
      <Img x={0} y={0} w={160} h={100} />
      <rect x={12} y={22} width={64} height={56} className="fill-background" />
      <T x={20} y={31} w={18} />
      <H x={20} y={37} w={46} />
      <Lines x={20} y={48} w={48} n={3} />
      <Btn x={20} y={66} w={28} />
    </>
  ),
  "image_banner.short": (
    <>
      <Img x={0} y={22} w={160} h={44} />
      <H x={55} y={40} w={50} h={6} />
      <Lines x={10} y={76} w={140} n={3} />
    </>
  ),
  slideshow: (
    <>
      <Img x={0} y={0} w={160} h={100} />
      <T x={10} y={56} w={22} />
      <H x={10} y={62} w={70} h={7} />
      <Btn x={10} y={74} w={26} filled />
      <rect x={10} y={91} width={10} height={1.2} className="fill-current opacity-80" />
      <rect x={23} y={91} width={10} height={1.2} className="fill-current opacity-30" />
      <rect x={36} y={91} width={10} height={1.2} className="fill-current opacity-30" />
      <path d="M134 91.5 l-3 -2.5 m3 2.5 l-3 2.5 M128 91.5 h6" className="stroke-current opacity-60" strokeWidth={0.8} fill="none" />
    </>
  ),
  cta_banner: (
    <>
      <Band y={14} h={72} />
      <H x={36} y={34} w={88} h={6} t="paper" />
      <Lines x={46} y={46} w={68} n={2} t="paper" center />
      <Btn x={52} y={60} w={26} filled t="paper" />
      <Btn x={82} y={60} w={26} t="paper" />
    </>
  ),
  "cta_banner.split": (
    <>
      <rect x={10} y={30} width={140} height={0.8} className="fill-current opacity-40" />
      <H x={10} y={42} w={70} h={6} />
      <Lines x={10} y={54} w={70} n={2} />
      <Btn x={116} y={56} w={34} filled />
    </>
  ),
  "cta_banner.image": (
    <>
      <Img x={0} y={10} w={160} h={80} />
      <H x={44} y={34} w={72} h={6} />
      <Lines x={52} y={46} w={56} n={2} center />
      <Btn x={66} y={60} w={28} filled />
    </>
  ),

  /* ---------------- Intro ---------------- */
  page_heading: (
    <>
      <H x={10} y={30} w={90} h={8} />
      <Lines x={10} y={48} w={110} n={4} />
    </>
  ),
  hero: (
    <>
      <Img x={0} y={0} w={160} h={100} />
      <rect x={70} y={90} width={6} height={1.2} className="fill-current opacity-80" />
      <rect x={78} y={90} width={6} height={1.2} className="fill-current opacity-30" />
      <rect x={86} y={90} width={6} height={1.2} className="fill-current opacity-30" />
    </>
  ),

  /* ---------------- Text & media ---------------- */
  text_block: (
    <>
      <H x={10} y={28} w={70} />
      <Lines x={10} y={40} w={120} n={5} />
      <Btn x={10} y={66} w={28} />
    </>
  ),
  rich_text: (
    <>
      <H x={30} y={22} w={100} h={6} />
      <Lines x={30} y={36} w={100} n={4} />
      <H x={30} y={58} w={60} h={4} />
      <Lines x={30} y={67} w={100} n={2} />
      <Btn x={30} y={80} w={26} filled />
    </>
  ),
  media_text: (
    <>
      <Img x={10} y={10} w={60} h={80} />
      <H x={84} y={34} w={56} />
      <Lines x={84} y={46} w={62} n={4} />
      <Btn x={84} y={68} w={28} />
    </>
  ),
  "media_text.right": (
    <>
      <Img x={90} y={10} w={60} h={80} />
      <H x={10} y={34} w={56} />
      <Lines x={10} y={46} w={66} n={4} />
      <Btn x={10} y={68} w={28} />
    </>
  ),
  "media_text.landscape": (
    <>
      <Img x={10} y={20} w={86} h={60} />
      <T x={108} y={34} w={16} />
      <H x={108} y={40} w={40} />
      <Lines x={108} y={51} w={42} n={3} />
      <T x={108} y={68} w={20} />
    </>
  ),
  multicolumn: (
    <>
      <H x={10} y={10} w={60} />
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={22} w={44} h={44} />
          <H x={x} y={71} w={30} h={3.5} />
          <Lines x={x} y={79} w={42} n={2} />
          <T x={x} y={91} w={14} />
        </React.Fragment>
      ))}
    </>
  ),
  "multicolumn.icons": (
    <>
      <H x={50} y={16} w={60} />
      {[24, 61, 98, 135].map((cx) => (
        <React.Fragment key={cx}>
          <Icon cx={cx} cy={42} />
          <H x={cx - 13} y={53} w={26} h={3.5} />
          <Lines x={cx - 15} y={61} w={30} n={2} center />
        </React.Fragment>
      ))}
    </>
  ),
  "multicolumn.cards": (
    <>
      <H x={10} y={14} w={56} />
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <rect x={x} y={28} width={44} height={56} className="fill-current opacity-[0.07]" />
          <H x={x + 6} y={36} w={26} h={3.5} />
          <Lines x={x + 6} y={45} w={32} n={4} />
        </React.Fragment>
      ))}
    </>
  ),
  "multicolumn.text": (
    <>
      {[10, 60, 110].map((x, index) => (
        <React.Fragment key={x}>
          {index > 0 && <rect x={x - 6} y={30} width={0.7} height={44} className="fill-current opacity-40" />}
          <H x={x} y={34} w={30} h={4} />
          <Lines x={x} y={44} w={38} n={5} />
        </React.Fragment>
      ))}
    </>
  ),
  stats: (
    <>
      {[10, 60, 110].map((x, index) => (
        <React.Fragment key={x}>
          {index > 0 && <rect x={x - 8} y={30} width={0.7} height={40} className="fill-current opacity-40" />}
          <H x={x} y={34} w={34} h={14} />
          <T x={x} y={56} w={28} />
        </React.Fragment>
      ))}
    </>
  ),
  steps: (
    <>
      <H x={10} y={14} w={70} />
      {[10, 46, 82, 118].map((x, index) => (
        <React.Fragment key={x}>
          <rect x={x} y={34} width={32} height={0.8} className="fill-current opacity-70" />
          <text x={x} y={48} className="fill-current text-[9px] opacity-80">{`0${index + 1}`}</text>
          <H x={x} y={55} w={24} h={3.5} />
          <Lines x={x} y={63} w={30} n={3} />
        </React.Fragment>
      ))}
    </>
  ),
  "steps.timeline": (
    <>
      <H x={40} y={8} w={60} />
      <rect x={40} y={22} width={0.8} height={72} className="fill-current opacity-40" />
      {[24, 48, 72].map((y) => (
        <React.Fragment key={y}>
          <circle cx={40.4} cy={y + 2} r={2} className="fill-current" />
          <H x={50} y={y} w={52} h={3.5} />
          <Lines x={50} y={y + 8} w={70} n={2} />
        </React.Fragment>
      ))}
    </>
  ),
  tabs: (
    <>
      <H x={10} y={10} w={50} />
      <rect x={10} y={30} width={140} height={0.6} className="fill-current opacity-30" />
      <rect x={10} y={23} width={18} height={2.5} className="fill-current opacity-80" />
      <rect x={10} y={29.4} width={18} height={1.4} className="fill-current" />
      <rect x={36} y={23} width={18} height={2.5} className="fill-current opacity-35" />
      <rect x={62} y={23} width={18} height={2.5} className="fill-current opacity-35" />
      <H x={10} y={44} w={56} />
      <Lines x={10} y={56} w={62} n={4} />
      <Img x={86} y={40} w={64} h={48} />
    </>
  ),
  collapsible: (
    <>
      <Img x={10} y={12} w={60} h={76} />
      <H x={84} y={14} w={48} />
      {[30, 46, 62, 78].map((y) => (
        <React.Fragment key={y}>
          <rect x={84} y={y} width={66} height={0.6} className="fill-current opacity-40" />
          <T x={84} y={y + 6} w={36} />
          <path d={`M146 ${y + 7} h4 M148 ${y + 5} v4`} strokeWidth={0.8} className="stroke-current opacity-70" />
        </React.Fragment>
      ))}
    </>
  ),
  video: (
    <>
      <H x={10} y={8} w={56} />
      <rect x={20} y={20} width={120} height={70} className="fill-current opacity-80" />
      <circle cx={80} cy={55} r={9} className="fill-background" />
      <path d="M77 50 L85 55 L77 60 Z" className="fill-current" />
    </>
  ),
  marquee: (
    <>
      <rect x={0} y={36} width={160} height={0.6} className="fill-current opacity-40" />
      <rect x={0} y={64} width={160} height={0.6} className="fill-current opacity-40" />
      <H x={-6} y={46} w={52} h={8} />
      <circle cx={53} cy={50} r={1.3} className="fill-current opacity-60" />
      <H x={60} y={46} w={44} h={8} />
      <circle cx={111} cy={50} r={1.3} className="fill-current opacity-60" />
      <H x={118} y={46} w={52} h={8} />
      <path d="M140 76 h10 m-3 -2.5 l3 2.5 l-3 2.5" strokeWidth={0.8} fill="none" className="stroke-current opacity-50" />
    </>
  ),
  item_list: (
    <>
      <H x={10} y={14} w={50} />
      {[30, 50, 70].map((y) => (
        <React.Fragment key={y}>
          <rect x={10} y={y - 4} width={140} height={0.6} className="fill-current opacity-30" />
          <H x={10} y={y} w={36} h={3.5} />
          <Lines x={70} y={y} w={80} n={2} />
        </React.Fragment>
      ))}
    </>
  ),
  faq: (
    <>
      <H x={10} y={14} w={60} />
      {[30, 44, 58, 72].map((y) => (
        <React.Fragment key={y}>
          <rect x={10} y={y} width={140} height={0.6} className="fill-current opacity-40" />
          <T x={10} y={y + 6} w={70} />
          <path d={`M146 ${y + 7} h4 M148 ${y + 5} v4`} strokeWidth={0.8} className="stroke-current opacity-70" />
        </React.Fragment>
      ))}
    </>
  ),

  /* ---------------- Images ---------------- */
  captioned_row: (
    <>
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={20} w={44} h={56} />
          <T x={x} y={81} w={28} />
        </React.Fragment>
      ))}
    </>
  ),
  full_image: <Img x={0} y={10} w={160} h={80} />,
  gallery: (
    <>
      <Img x={10} y={10} w={44} h={38} />
      <Img x={58} y={10} w={44} h={38} />
      <Img x={106} y={10} w={44} h={38} />
      <Img x={10} y={52} w={44} h={38} />
      <Img x={58} y={52} w={44} h={38} />
      <Img x={106} y={52} w={44} h={38} />
    </>
  ),
  collage: (
    <>
      <Img x={10} y={10} w={68} h={74} />
      <T x={10} y={88} w={20} />
      <Img x={82} y={10} w={68} h={33} />
      <Img x={82} y={51} w={68} h={33} />
      <T x={82} y={88} w={20} />
    </>
  ),
  "collage.even": (
    <>
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={22} w={44} h={56} />
          <H x={x + 4} y={70} w={22} h={3.5} />
        </React.Fragment>
      ))}
    </>
  ),

  /* ---------------- Social proof ---------------- */
  testimonials: (
    <>
      <H x={10} y={12} w={64} />
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <rect x={x} y={26} width={44} height={62} className="fill-current opacity-[0.07]" />
          <text x={x + 5} y={40} className="fill-current text-[14px] opacity-60">
            “
          </text>
          <Lines x={x + 5} y={42} w={34} n={4} />
          <circle cx={x + 9} cy={79} r={3.5} className="fill-current opacity-25" />
          <T x={x + 15} y={78} w={18} />
        </React.Fragment>
      ))}
    </>
  ),
  "testimonials.single": (
    <>
      <text x={74} y={34} className="fill-current text-[20px] opacity-50">
        “
      </text>
      <H x={22} y={38} w={116} h={6} />
      <H x={38} y={48} w={84} h={6} />
      <circle cx={80} cy={66} r={4} className="fill-current opacity-25" />
      <T x={68} y={74} w={24} />
    </>
  ),
  logo_list: (
    <>
      <H x={55} y={28} w={50} h={4} />
      {[12, 41, 70, 99, 128].map((x) => (
        <rect key={x} x={x} y={48} width={22} height={8} rx={1} className="fill-current opacity-30" />
      ))}
    </>
  ),

  /* ---------------- Catalogue ---------------- */
  product_rail: (
    <>
      <H x={10} y={12} w={50} />
      {[10, 46, 82, 118].map((x) => (
        <Card key={x} x={x} y={24} w={32} h={50} />
      ))}
      <path d="M152 49 l-3 -3 m3 3 l-3 3" strokeWidth={0.8} fill="none" className="stroke-current opacity-60" />
    </>
  ),
  product_grid: (
    <>
      {[10, 46, 82, 118].map((x) => (
        <React.Fragment key={x}>
          <Card x={x} y={8} w={32} h={42} />
          <Card x={x} y={52} w={32} h={42} />
        </React.Fragment>
      ))}
    </>
  ),
  product_mosaic: (
    <>
      <Img x={10} y={10} w={68} h={80} />
      <Img x={82} y={10} w={32} h={38} />
      <Img x={118} y={10} w={32} h={38} />
      <Img x={82} y={52} w={32} h={38} />
      <Img x={118} y={52} w={32} h={38} />
    </>
  ),
  collection_carousel: (
    <>
      <H x={10} y={12} w={60} />
      {[10, 56, 102].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={24} w={42} h={56} />
          <H x={x} y={84} w={24} h={3.5} />
        </React.Fragment>
      ))}
    </>
  ),
  collection_grid: (
    <>
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={8} w={44} h={36} />
          <T x={x} y={47} w={22} />
          <Img x={x} y={54} w={44} h={36} />
          <T x={x} y={93} w={22} />
        </React.Fragment>
      ))}
    </>
  ),
  featured_product: (
    <>
      <Img x={10} y={8} w={66} h={56} />
      <Img x={10} y={67} w={32} h={26} />
      <Img x={44} y={67} w={32} h={26} />
      <T x={90} y={30} w={16} />
      <H x={90} y={36} w={50} h={7} />
      <Lines x={90} y={50} w={56} n={3} />
      <Btn x={90} y={66} w={28} filled />
    </>
  ),
  project_cards: (
    <>
      <H x={10} y={12} w={50} />
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={24} w={44} h={52} />
          <H x={x} y={80} w={28} h={3.5} />
        </React.Fragment>
      ))}
    </>
  ),
  // A row cut off at the right edge, with the arrows: it scrolls.
  project_carousel: (
    <>
      <H x={10} y={12} w={50} />
      {[10, 56, 102, 148].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={24} w={42} h={50} />
          <H x={x} y={78} w={26} h={3.5} />
        </React.Fragment>
      ))}
      <rect x={10} y={88} width={8} height={5} rx={2.5} className="fill-current opacity-40" />
      <rect x={21} y={88} width={8} height={5} rx={2.5} className="fill-current opacity-40" />
    </>
  ),
  designer_grid: (
    <>
      {[10, 46, 82, 118].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={14} w={32} h={40} />
          <T x={x} y={58} w={22} />
          <Img x={x} y={64} w={32} h={24} />
        </React.Fragment>
      ))}
    </>
  ),

  /* ---------------- Layout ---------------- */
  spacer: (
    <>
      <rect x={0} y={0} width={160} height={26} className="fill-current opacity-[0.07]" />
      <rect x={0} y={74} width={160} height={26} className="fill-current opacity-[0.07]" />
      <path d="M80 34 v32 M76 38 l4 -4 l4 4 M76 62 l4 4 l4 -4" strokeWidth={0.8} fill="none" className="stroke-current opacity-60" />
    </>
  ),
  "spacer.divider": (
    <>
      <Lines x={10} y={20} w={140} n={3} />
      <rect x={10} y={50} width={140} height={0.8} className="fill-current opacity-60" />
      <Lines x={10} y={66} w={140} n={3} />
    </>
  ),

  /* ---------------- Site ---------------- */
  locations: (
    <>
      {[10, 58, 106].map((x) => (
        <React.Fragment key={x}>
          <Img x={x} y={14} w={44} h={40} />
          <H x={x} y={60} w={28} h={3.5} />
          <Lines x={x} y={68} w={40} n={3} />
        </React.Fragment>
      ))}
    </>
  ),
  instagram: (
    <>
      {[4, 36, 68, 100, 132].map((x) => (
        <Img key={x} x={x} y={30} w={28} h={28} />
      ))}
      <T x={60} y={66} w={40} />
    </>
  ),
  contact_details: (
    <>
      <H x={10} y={14} w={50} />
      <Lines x={10} y={28} w={50} n={6} />
      {[28, 40, 52, 64].map((y) => (
        <rect key={y} x={78} y={y} width={72} height={0.6} className="fill-current opacity-50" />
      ))}
      <Btn x={78} y={76} w={40} />
    </>
  ),
  contact_cta: (
    <>
      <H x={40} y={36} w={80} h={6} />
      <Btn x={64} y={52} w={32} />
    </>
  ),
  newsletter: (
    <>
      <H x={50} y={28} w={60} h={6} />
      <Lines x={40} y={40} w={80} n={2} center />
      <rect x={45} y={64} width={70} height={0.8} className="fill-current opacity-70" />
      <T x={45} y={58} w={30} />
      <T x={103} y={58} w={12} />
    </>
  ),
  go_back: (
    <>
      <path d="M14 50 h14 m-14 0 l4 -4 m-4 4 l4 4" strokeWidth={0.9} fill="none" className="stroke-current opacity-70" />
      <T x={32} y={49} w={26} />
    </>
  ),
};

const FALLBACK = (
  <>
    <H x={10} y={30} w={70} />
    <Lines x={10} y={42} w={140} n={5} />
  </>
);

export function SectionThumbnail({ id, type, className }: { id: string; type: string; className?: string }) {
  const drawing = THUMBNAILS[id] ?? THUMBNAILS[type] ?? FALLBACK;
  return (
    <svg viewBox="0 0 160 100" aria-hidden className={className} preserveAspectRatio="xMidYMid meet">
      {drawing}
    </svg>
  );
}
