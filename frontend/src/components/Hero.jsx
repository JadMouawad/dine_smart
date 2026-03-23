import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import dish from "../assets/dish.png";

export default function Hero({ onGettingStarted }) {
  const titleRef = useRef(null);
  const descRef  = useRef(null);
  const ctaRef   = useRef(null);
  const dishRef  = useRef(null);
  const waveRef  = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      gsap.set([titleRef.current, descRef.current, ctaRef.current], { opacity: 0, y: 40 });
      gsap.set(dishRef.current, { opacity: 0, scale: 0.88, rotate: -6 });
      gsap.set(waveRef.current, { opacity: 0, y: 60 });

      tl
        .to(titleRef.current, { opacity: 1, y: 0, duration: 0.7 })
        .to(descRef.current,  { opacity: 1, y: 0, duration: 0.6 }, "-=0.4")
        .to(ctaRef.current,   { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.4)" }, "-=0.3")
        .to(dishRef.current,  { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: "power2.out" }, "-=0.6")
        .to(waveRef.current,  { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, "-=0.7");
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="hero">
      <div className="hero__left">
        <h1 className="hero__title" ref={titleRef}>
          Dine Smarter,<br />
          Not Harder
        </h1>
        <p className="hero__desc" ref={descRef}>
          Discover restaurant menus instantly. Connect with your favorite eateries and explore culinary experiences
          like never before.
        </p>

        <div className="hero__cta" ref={ctaRef}>
          <button className="btn btn--gold btn--xl btn--white-text" type="button" onClick={onGettingStarted}>
            GETTING STARTED
          </button>
        </div>
      </div>

      <div className="scene">
        <img className="dish" src={dish} alt="" ref={dishRef} />

        <svg className="gold-wave" viewBox="0 0 900 260" preserveAspectRatio="none" aria-hidden="true" ref={waveRef}>
          <path
            d="M900,260 H0
               C180,240 260,190 360,165
               C480,135 585,155 690,130
               C790,105 845,55 900,0
               V260 Z"
            fill="#C9A227"
          />
        </svg>
      </div>
    </div>
  );
}
