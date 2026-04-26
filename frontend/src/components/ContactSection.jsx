import React from "react";
import { HiOutlineEnvelope, HiArrowUpRight } from "react-icons/hi2";
import EmailImage from "../assets/landing/DSEmail.png";

export default function ContactSection() {
  return (
    <section className="contactSection" aria-label="Contact DineSmart">
      <div className="contactSection__inner">
        <div className="contactSection__media">
          <div className="contactSection__glow" aria-hidden="true" />
          <img
            src={EmailImage}
            alt="Contact DineSmart"
            className="contactSection__image"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="contactSection__content">
          <div className="contactSection__eyebrow">Contact Us</div>

          <h2 className="contactSection__title">
            Let's bring smarter dining to your inbox.
          </h2>

          <p className="contactSection__text">
            Have a question, an idea, a partnership opportunity, or simply want
            to reach the DineSmart team? We'd love to hear from you. Do not
            hesitate to contact us and we'll get back to you as soon as possible.
          </p>

          <a
            className="contactSection__email"
            href="mailto:dinesmart.team@gmail.com"
          >
            <HiOutlineEnvelope />
            <span>dinesmart.team@gmail.com</span>
            <HiArrowUpRight />
          </a>
        </div>
      </div>
    </section>
  );
}
