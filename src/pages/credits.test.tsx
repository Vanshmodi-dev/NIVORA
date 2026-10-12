import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ImageCredit } from "../data/images";
import { Credits } from "./Credits";

const row: ImageCredit = {
  src: "/images/fx01-1.jpg",
  alt: "Illustrative living area",
  sourceUrl: "https://www.pexels.com/photo/example-123/",
  photographer: "A. Photographer",
  photographerUrl: "https://www.pexels.com/@example",
  acquiredOn: "2026-10-12",
  licence: { name: "Pexels License", url: "https://www.pexels.com/license/" },
  modifications: "None",
  usedBy: ["NIV-DEMO-P001"],
};

const renderCredits = (registry: Record<string, ImageCredit>) =>
  render(
    <MemoryRouter>
      <Credits registry={registry} />
    </MemoryRouter>,
  );

describe("Credits page (AC-38, gate step 4)", () => {
  it("says plainly that no photos are installed when the registry is empty, and still credits map data", () => {
    renderCredits({});
    expect(screen.getByTestId("no-images")).toHaveTextContent(/No licensed photographs are installed yet/);
    expect(screen.queryByTestId("photo-credits")).toBeNull();
    expect(screen.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(screen.getByText(/simulated positions of fictional listings/)).toBeInTheDocument();
    expect(screen.getByText(/no affiliation with or endorsement/)).toBeInTheDocument();
  });
  it("lists every installed photo with photographer, source page, licence, date and use", () => {
    renderCredits({ "fx01-1": row });
    const list = within(screen.getByTestId("photo-credits"));
    expect(list.getByRole("link", { name: "Illustrative living area" })).toHaveAttribute("href", row.sourceUrl);
    expect(list.getByRole("link", { name: "A. Photographer" })).toHaveAttribute("href", row.photographerUrl!);
    expect(screen.getByTestId("photo-credits")).toHaveTextContent(/Pexels License · acquired 2026-10-12 · None · used by NIV-DEMO-P001/);
    expect(screen.queryByTestId("no-images")).toBeNull();
  });
});
