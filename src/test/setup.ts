import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Leaflet needs a real layout engine; unit tests use a stub that records its props.
vi.mock("../onboarding/MapView", async () => await import("./MapViewStub"));

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});
