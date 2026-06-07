import { Quote, Star, UserRound } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";

/**
 * PLACEHOLDER REVIEWS — layout only.
 *
 * The entries below are deliberately generic, fill-in-the-blank templates: NO
 * real names, NO photos, NO recovery-amount or outcome claims. Replace `REVIEWS`
 * with genuine, attributable client reviews before launch and delete the
 * placeholder note at the bottom of the section. Do NOT ship fabricated
 * testimonials on a victim-facing recovery site.
 */
interface Review {
  quote: string;
  author: string;
  meta: string;
  rating: number;
}

const REVIEWS: Review[] = [
  {
    quote:
      "A short quote from a real client about the free case review and what made them comfortable getting started.",
    author: "Client name",
    meta: "Recovery client · Location",
    rating: 5,
  },
  {
    quote:
      "A client's words on the communication and transparency they experienced as their case progressed.",
    author: "Client name",
    meta: "Escrow client · Location",
    rating: 5,
  },
  {
    quote:
      "Feedback about the secure escrow record and the authorized-withdrawal process at the close of a case.",
    author: "Client name",
    meta: "Recovery client · Location",
    rating: 5,
  },
];

export function ReviewsSection() {
  return (
    <section className="py-16 sm:py-20" aria-label="Client reviews">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Client feedback"
          title="What clients say about working with us"
          subtitle="Hear from people who filed a complaint and tracked recovered funds with Digital Asset Investigations."
        />

        <ul className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {REVIEWS.map((review, index) => (
            <li
              key={index}
              className="relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md transition-colors hover:border-white/20 sm:p-7"
            >
              <Quote className="h-7 w-7 text-primary/40" aria-hidden="true" />

              <div
                className="mt-4 flex items-center gap-0.5"
                role="img"
                aria-label={`${review.rating} out of 5 stars`}
              >
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star
                    key={star}
                    className={
                      star < review.rating
                        ? "h-4 w-4 fill-amber-400 text-amber-400"
                        : "h-4 w-4 text-muted-foreground/30"
                    }
                    aria-hidden="true"
                  />
                ))}
              </div>

              <p className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-foreground/90">
                &ldquo;{review.quote}&rdquo;
              </p>

              <div className="mt-6 flex items-center gap-3 border-t border-white/8 pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {review.author}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {review.meta}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Placeholder reviews — replace with verified client feedback before launch.
        </p>
      </div>
    </section>
  );
}

export default ReviewsSection;
