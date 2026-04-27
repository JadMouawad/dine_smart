import React from "react";
import { HiArrowRight } from "react-icons/hi2";
import SpeakerImage from "../assets/landing/Speaker.webp";

export default function EventsInviteSection({ onJoinEvents }) {
  return (
    <section className="eventsInviteSection" aria-label="Join restaurant events">
      <div className="eventsInviteSection__inner">
        <div className="eventsInviteSection__content">
          <div className="eventsInviteSection__eyebrow">Discover Events</div>

          <h2 className="eventsInviteSection__title">
            Make every outing worth it.
          </h2>

          <p className="eventsInviteSection__text">
            From live music nights to curated culinary experiences,
            discover events that make dining feel more exciting,
            social, and memorable. Reserve your spot before it's gone!
          </p>

          <button
            type="button"
            className="eventsInviteSection__cta"
            onClick={onJoinEvents}
          >
            <span>Join events</span>
            <HiArrowRight />
          </button>
        </div>

        <div className="eventsInviteSection__media">
          <div className="eventsInviteSection__glow" aria-hidden="true" />
          <img
            src={SpeakerImage}
            alt="Discover restaurant events"
            className="eventsInviteSection__image"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
