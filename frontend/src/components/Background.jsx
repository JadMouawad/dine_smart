import React from "react";

export default function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__glow bg__glow--tl" />
      <div className="bg__glow bg__glow--br" />
      <div className="bg__grain" />
    </div>
  );
}
