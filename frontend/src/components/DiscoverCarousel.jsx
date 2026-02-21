import React from "react";
import american from "../assets/cuisines/american.png";
import middleEastern from "../assets/cuisines/middle-eastern.png";
import french from "../assets/cuisines/french.png";
import mexican from "../assets/cuisines/mexican.png";
import chinese from "../assets/cuisines/chinese.png";
import japanese from "../assets/cuisines/japanese.png";
import italian from "../assets/cuisines/italian.png";
import indian from "../assets/cuisines/indian.png";
import international from "../assets/cuisines/international.png";

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

export default function DiscoverCarousel() {
  return (
    <section className="discover" id="discover">
      <div className="discover__inner">
        <h2 className="discover__title">Our Cuisines</h2>
        <p className="discover__subtitle">
          Find your next delicious meal from a variety of culinary traditions!
        </p>

        <div className="discover__carousel">

          <div className="discover__track autoScroll">

            {[...CUISINES, ...CUISINES].map((c, index) => (
              <div className="discover__card" key={c.label + index}>
                <img src={c.src} alt={c.alt} />
                <span className="discover__label">{c.label}</span>
              </div>
            ))}

          </div>

        </div>
      </div>
    </section>
  );
}