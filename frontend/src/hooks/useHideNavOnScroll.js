import { useEffect, useRef, useState } from "react";

export default function useHideNavOnScroll({ disabled = false } = {}) {
  const [pillScrolled, setPillScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (disabled) {
      setPillScrolled(window.scrollY > 10);
      setNavHidden(false);
      lastScrollYRef.current = window.scrollY;
      return;
    }

    function onScroll() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      setPillScrolled(currentScrollY > 10);

      if (currentScrollY <= 10) {
        setNavHidden(false);
      } else if (currentScrollY > 80 && delta > 8) {
        setNavHidden(true);
      } else if (delta < -8) {
        setNavHidden(false);
      }

      lastScrollYRef.current = Math.max(currentScrollY, 0);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [disabled]);

  return { pillScrolled, navHidden };
}
