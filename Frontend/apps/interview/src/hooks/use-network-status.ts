import { useEffect, useState } from "react";

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine)
  );

  useEffect(() => {
    function syncNetworkStatus() {
      setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    }

    syncNetworkStatus();
    window.addEventListener("online", syncNetworkStatus);
    window.addEventListener("offline", syncNetworkStatus);

    return () => {
      window.removeEventListener("online", syncNetworkStatus);
      window.removeEventListener("offline", syncNetworkStatus);
    };
  }, []);

  return isOnline;
}
