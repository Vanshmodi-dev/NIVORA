import { Modal, type ModalProps } from "./Modal";

/** Side panel built on Modal (focus trap, Esc, focus restore). Used for slide-over navigation. */
export function Drawer(props: Omit<ModalProps, "variant">) {
  return <Modal {...props} variant="drawer" />;
}
