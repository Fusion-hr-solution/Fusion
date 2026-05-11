import { useState, useCallback, useRef, useEffect } from "react";

export function useChapterTitle(
  initialTitle: string | undefined,
  onSave: (title: string) => Promise<void>,
) {
  const [titleValue, setTitleValue] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const titleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (titleTimeout.current) clearTimeout(titleTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (initialTitle) setTitleValue(initialTitle);
  }, [initialTitle]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitleValue(value);
      setTitleSaved(false);
      if (titleTimeout.current) clearTimeout(titleTimeout.current);
      titleTimeout.current = setTimeout(async () => {
        if (value.trim()) {
          if (!mountedRef.current) return;
          setIsSavingTitle(true);
          try {
            await onSave(value.trim());
            if (!mountedRef.current) return;
            setTitleSaved(true);
            setTimeout(() => {
              if (mountedRef.current) setTitleSaved(false);
            }, 2000);
          } catch {
            // Save failed — silently ignore, user can retry
          } finally {
            if (mountedRef.current) setIsSavingTitle(false);
          }
        }
      }, 800);
    },
    [onSave],
  );

  return { titleValue, handleTitleChange, isSavingTitle, titleSaved };
}
