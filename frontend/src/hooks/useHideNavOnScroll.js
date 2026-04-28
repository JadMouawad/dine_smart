import { useEffect, useRef, useState } from "react";

export default function useHideNavOnScroll({ disabled = false } = {}) {
  const [pillScrolled, setPillScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    function getScrollY(event) {
      const target = event?.target;
      if (target && target !== window && target !== document && Number.isFinite(target.scrollTop)) {
        return target.scrollTop;
      }
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    if (disabled) {
      setPillScrolled(getScrollY() > 10);
      setNavHidden(false);
      lastScrollYRef.current = getScrollY();
      return;
    }

    function onScroll(event) {
      const currentScrollY = getScrollY(event);
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
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [disabled]);

  return { pillScrolled, navHidden };
}
