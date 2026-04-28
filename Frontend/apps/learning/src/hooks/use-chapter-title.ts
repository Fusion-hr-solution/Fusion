import { useState, useCallback, useRef, useEffect } from "react";

export function useChapterTitle(
  initialTitle: string | undefined,
  onSave: (title: string) => Promise<void>,
) {
  const [titleValue, setTitleValue] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const titleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setIsSavingTitle(true);
          await onSave(value.trim());
          setIsSavingTitle(false);
          setTitleSaved(true);
          setTimeout(() => setTitleSaved(false), 2000);
        }
      }, 800);
    },
    [onSave],
  );

  return { titleValue, handleTitleChange, isSavingTitle, titleSaved };
}
