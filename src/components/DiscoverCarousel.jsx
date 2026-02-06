import React, { useRef } from "react";

const CUISINES = [
  { src: "/assets/cuisines/american.png", label: "American", alt: "American" },
  { src: "/assets/cuisines/middle-eastern.png", label: "Middle Eastern", alt: "Middle Eastern" },
  { src: "/assets/cuisines/french.png", label: "French", alt: "French" },
  { src: "/assets/cuisines/mexican.png", label: "Mexican", alt: "Mexican" },
  { src: "/assets/cuisines/chinese.png", label: "Chinese", alt: "Chinese" },
  { src: "/assets/cuisines/japanese.png", label: "Japanese", alt: "Japanese" },
  { src: "/assets/cuisines/italian.png", label: "Italian", alt: "Italian" },
  { src: "/assets/cuisines/indian.png", label: "Indian", alt: "Indian" },
  { src: "/assets/cuisines/international.png", label: "International", alt: "International" },
];

export default function DiscoverCarousel() {
  const trackRef = useRef(null);

  function scrollByAmount(dir) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: "smooth" });
  }

  return (
    <section className="discover" id="discover">
      <div className="discover__inner">
        <h2 className="discover__title">Our Cuisines</h2>
        <p className="discover__subtitle">
          Find your next delicious meal from a variety of culinary traditions!
        </p>

        <div className="discover__carousel">
          <button
            className="discover__arrow discover__arrow--left"
            type="button"
            aria-label="Previous"
            onClick={() => scrollByAmount(-1)}
          >
            ‹
          </button>

          <div className="discover__track" ref={trackRef}>
            {CUISINES.map((c) => (
              <div className="discover__card" key={c.label}>
                <img src={c.src} alt={c.alt} />
                <span className="discover__label">{c.label}</span>
              </div>
            ))}
          </div>

          <button
            className="discover__arrow discover__arrow--right"
            type="button"
            aria-label="Next"
            onClick={() => scrollByAmount(1)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
