import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// jsdom n'a pas ResizeObserver (utilisé par les graphiques Recharts).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
