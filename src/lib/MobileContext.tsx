import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface MobileContextType {
  /** Текущий режим: true = мобильный вид */
  isMobile: boolean;
  /** Принудительный режим: null = авто, true = мобильный, false = десктоп */
  forceMode: boolean | null;
  /** Переключить режим */
  toggleMode: () => void;
  /** Открыто ли мобильное меню */
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}

const MobileContext = createContext<MobileContextType>({
  isMobile: false,
  forceMode: null,
  toggleMode: () => {},
  menuOpen: false,
  setMenuOpen: () => {},
});

const STORAGE_KEY = "portal_view_mode";
const MOBILE_BREAKPOINT = 768;

export function MobileProvider({ children }: { children: ReactNode }) {
  const [forceMode, setForceMode] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "mobile") return true;
    if (stored === "desktop") return false;
    return null;
  });

  const [screenIsMobile, setScreenIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT,
  );

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onResize() {
      setScreenIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = forceMode !== null ? forceMode : screenIsMobile;

  const toggleMode = useCallback(() => {
    setForceMode((prev) => {
      const currentlyMobile = prev !== null ? prev : screenIsMobile;
      const next = !currentlyMobile;
      localStorage.setItem(STORAGE_KEY, next ? "mobile" : "desktop");
      return next;
    });
    setMenuOpen(false);
  }, [screenIsMobile]);

  return (
    <MobileContext.Provider value={{ isMobile, forceMode, toggleMode, menuOpen, setMenuOpen }}>
      {children}
    </MobileContext.Provider>
  );
}

export function useMobile() {
  return useContext(MobileContext);
}
