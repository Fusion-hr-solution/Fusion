import type { ComponentType, ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

type Wrapper = ComponentType<{ children: ReactNode }>;
type WithWrapper = { wrapper?: Wrapper } | undefined;

/**
 * Testing Library with an intl provider around every `render` and `renderHook`, in English unless a test supplies
 * its own (an inner provider wins). For a test setup file, so components that speak the person's language render
 * in tests that predate translation:
 *
 *   vi.mock("@testing-library/react", async (original) =>
 *     (await import("@repo/ds/testing/intl-by-default")).withIntlByDefault(await original(), messages));
 *
 * It imports nothing from Testing Library itself, so it is safe inside that mock.
 */
export function withIntlByDefault<T extends { render: (...args: never[]) => unknown; renderHook: (...args: never[]) => unknown }>(
  library: T,
  messages: AbstractIntlMessages,
): T {
  const wrap = (options: WithWrapper) => {
    const Inner = options?.wrapper;
    return function IntlByDefault({ children }: { children: ReactNode }) {
      return (
        <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Tunis">
          {Inner ? <Inner>{children}</Inner> : children}
        </NextIntlClientProvider>
      );
    };
  };
  const render = library.render as (ui: unknown, options?: WithWrapper) => unknown;
  const renderHook = library.renderHook as (callback: unknown, options?: WithWrapper) => unknown;
  return {
    ...library,
    render: (ui: unknown, options?: WithWrapper) => render(ui, { ...options, wrapper: wrap(options) }),
    renderHook: (callback: unknown, options?: WithWrapper) => renderHook(callback, { ...options, wrapper: wrap(options) }),
  } as T;
}
