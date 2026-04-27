import React from "react";
import american from "../assets/cuisines/american.webp";
import middleEastern from "../assets/cuisines/middle-eastern.webp";
import french from "../assets/cuisines/french.webp";
import mexican from "../assets/cuisines/mexican.webp";
import chinese from "../assets/cuisines/chinese.webp";
import japanese from "../assets/cuisines/japanese.webp";
import italian from "../assets/cuisines/italian.webp";
import indian from "../assets/cuisines/indian.webp";
import international from "../assets/cuisines/international.webp";

const CUISINES = [
  { src: american, label: "American", alt: "American" },
  { src: middleEastern, label: "Middle Eastern", alt: "Middle Eastern" },
  { src: french, label: "French", alt: "French" },
  { src: mexican, label: "Mexican", alt: "Mexican" },
  { src: chinese, label: "Chinese", alt: "Chinese" },
  { src: japanese, label: "Japanese", alt: "Japanese" },
  { src: italian, label: "Italian", alt: "Italian" },
  { src: indian, label: "Indian", alt: "Indian" },
  { src: international, label: "International", alt: "International" },
];

export default function DiscoverCarousel({ onSelectCuisine }) {
  return (
    <section className="discover" id="discover">
      <div className="discover__inner">
        <h2 className="discover__title">Discover Flavors</h2>
        <p className="discover__subtitle">
          Find your next delicious meal from a variety of culinary traditions!
        </p>

        <div className="discover__carousel">
          <div className="discover__track autoScroll">
            {[...CUISINES, ...CUISINES, ...CUISINES].map((c, index) => (
              <button
                className="discover__card"
                key={c.label + index}
                type="button"
                onClick={() => onSelectCuisine?.(c.label)}
                aria-label={`View ${c.label} restaurants`}
              >
                <img src={c.src} alt={c.alt} loading="lazy" decoding="async" />
                <span className="discover__label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
