import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppImage } from "./AppImage";
import { Badge } from "./Badge";
import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "./Modal";
import { ToastProvider, useToast, type ToastInput } from "./Toast";

function ModalHarness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Modal
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Example dialog"
        footer={<button>Save</button>}
      >
        <button>First action</button>
      </Modal>
    </div>
  );
}

describe("Modal", () => {
  it("is an accessible modal dialog named by its title and moves focus into it", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = screen.getByRole("dialog", { name: "Example dialog" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Example dialog" })).toHaveFocus();
  });

  it("traps Tab inside the dialog, closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalHarness onClose={onClose} />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);

    const close = screen.getByRole("button", { name: "Close" });
    const first = screen.getByRole("button", { name: "First action" });
    const save = screen.getByRole("button", { name: "Save" });

    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(save).toHaveFocus();
    await user.tab(); // wraps
    expect(close).toHaveFocus();
    await user.tab({ shift: true }); // wraps backwards
    expect(save).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("does not close on Escape while non-dismissible", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Busy" dismissible={false}>
        <p>Working</p>
      </Modal>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("only the top-most of stacked modals handles Escape", async () => {
    const user = userEvent.setup();
    const closeA = vi.fn();
    const closeB = vi.fn();
    render(
      <>
        <Modal open onClose={closeA} title="Lower">
          <p>a</p>
        </Modal>
        <Modal open onClose={closeB} title="Upper">
          <p>b</p>
        </Modal>
      </>,
    );
    await user.keyboard("{Escape}");
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog", () => {
  it("names the action on its confirm button and calls the right handler", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Mark unavailable?" confirmLabel="Mark unavailable" destructive onConfirm={onConfirm} onCancel={onCancel}>
        <p>This home will disappear from Tenant search.</p>
      </ConfirmDialog>,
    );
    expect(screen.queryByRole("button", { name: "OK" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Mark unavailable" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

function ToastButtons({ inputs }: { inputs: ToastInput[] }) {
  const { toast } = useToast();
  return (
    <>
      {inputs.map((t, i) => (
        <button key={i} onClick={() => toast(t)}>
          {`fire ${i}`}
        </button>
      ))}
    </>
  );
}

describe("Toast", () => {
  afterEach(() => vi.useRealTimers());

  it("announces via a polite live region, auto-dismisses success after 4 s, keeps errors", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastButtons
          inputs={[
            { tone: "success", title: "Saved to your homes" },
            { tone: "error", title: "Could not save" },
          ]}
        />
      </ToastProvider>,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByText("fire 0"));
    fireEvent.click(screen.getByText("fire 1"));
    expect(screen.getByText("Saved to your homes")).toBeInTheDocument();
    expect(screen.getByText("Could not save")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText("Saved to your homes")).not.toBeInTheDocument();
    expect(screen.getByText("Could not save")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Could not save")).not.toBeInTheDocument();
  });

  it("stacks at most three toasts", () => {
    render(
      <ToastProvider>
        <ToastButtons inputs={[1, 2, 3, 4].map((n) => ({ tone: "error" as const, title: `Problem ${n}` }))} />
      </ToastProvider>,
    );
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText(`fire ${i}`));
    expect(screen.getAllByTestId("toast")).toHaveLength(3);
    expect(screen.queryByText("Problem 1")).not.toBeInTheDocument();
    expect(screen.getByText("Problem 4")).toBeInTheDocument();
  });

  it("runs a toast action once and dismisses the toast", () => {
    const undo = vi.fn();
    render(
      <ToastProvider>
        <ToastButtons inputs={[{ tone: "info", title: "Removed", action: { label: "Undo", onClick: undo } }]} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("fire 0"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Removed")).not.toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("always renders text plus an icon, so colour is never the only cue", () => {
    const { container } = render(
      <>
        {(["positive", "warning", "pending", "neutral", "error"] as const).map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone} label
          </Badge>
        ))}
      </>,
    );
    const badges = container.querySelectorAll("[data-tone]");
    expect(badges).toHaveLength(5);
    badges.forEach((b) => {
      expect(b.querySelector("svg")).not.toBeNull();
      expect(b.textContent).toMatch(/label$/);
    });
  });
});

describe("AppImage", () => {
  it("shows the neutral placeholder (not a broken image) when there is no source", () => {
    render(<AppImage alt="Living room with sofa and window" />);
    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Living room with sofa and window" })).toBeInTheDocument();
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("falls back to the placeholder when the image fails to load", () => {
    render(<AppImage src="/missing.webp" alt="Bedroom" />);
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("applies a credit's focus point to the crop and shows the thumbnail label only with a real photo", () => {
    const { unmount } = render(<AppImage src="/ok.webp" alt="Bathroom" focus="50% 0%" badge />);
    expect(screen.getByAltText("Bathroom")).toHaveStyle({ objectPosition: "50% 0%" });
    expect(screen.queryByText("Illustrative")).toBeNull(); // not while loading
    fireEvent.load(screen.getByAltText("Bathroom"));
    expect(screen.getByText("Illustrative")).toHaveAttribute("aria-hidden", "true");
    unmount();
    render(<AppImage alt="Bathroom" badge />);
    expect(screen.queryByText("Illustrative")).toBeNull();
  });

  it("shows the image once it has loaded, lazily by default", () => {
    render(<AppImage src="/ok.webp" alt="Kitchen" />);
    const img = screen.getByAltText("Kitchen");
    expect(img).toHaveAttribute("loading", "lazy");
    fireEvent.load(img);
    expect(screen.queryByTestId("image-placeholder")).not.toBeInTheDocument();
  });
});
