import React from "react";
import dish from "../assets/dish.png";

export default function Hero({ onGettingStarted }) {
  return (
    <div className="hero">
      <div className="hero__left">
        <h1 className="hero__title">
          Dine Smarter,<br />
          Not Harder
        </h1>
        <p className="hero__desc">
          Discover restaurant menus instantly. Connect with your favorite eateries and explore culinary experiences
          like never before.
        </p>

        <div className="hero__cta">
          <button className="btn btn--gold btn--xl btn--white-text" type="button" onClick={onGettingStarted}>
            GETTING STARTED
          </button>
        </div>
      </div>

      <div className="scene">
        <img className="dish" src={dish} alt="" />

        <svg className="gold-wave" viewBox="0 0 900 260" preserveAspectRatio="none" aria-hidden="true">
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
