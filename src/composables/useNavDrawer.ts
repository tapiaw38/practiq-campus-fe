import { nextTick, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { useRoute } from "vue-router";

/**
 * Mobile navigation drawer behaviour, shared by both shells.
 *
 * The layouts previously only toggled a boolean: the drawer could not be
 * closed with Escape, focus stayed behind on the page while the drawer covered
 * it, the page underneath scrolled while the drawer was open, and focus was
 * dropped at the top of the document on close. All of that lives here now so
 * the student and teacher shells cannot drift apart on it.
 */
export function useNavDrawer(options: {
  toggle: Ref<HTMLElement | null>;
  panel: Ref<HTMLElement | null>;
}) {
  const route = useRoute();
  const open = ref(false);

  function close(restoreFocus = true) {
    if (!open.value) return;
    open.value = false;
    if (restoreFocus) options.toggle.value?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
  }

  function releaseBody() {
    document.body.style.removeProperty("overflow");
  }

  watch(open, (isOpen) => {
    if (isOpen) {
      // The drawer sits over the page, so the page behind it must not scroll
      // under the finger while the drawer is what the user is looking at.
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKeydown);
      // Move focus into the drawer, otherwise the next Tab continues from the
      // hamburger and walks through content hidden behind the backdrop. The
      // panel is `visibility: hidden` until the open class lands, and a hidden
      // element cannot take focus, so this waits for the DOM and one paint.
      void nextTick(() => requestAnimationFrame(() => options.panel.value?.focus()));
      return;
    }
    releaseBody();
    document.removeEventListener("keydown", onKeydown);
  });

  // Navigating closes the drawer, but without restoring focus: the click that
  // navigated already moved it, and the destination page should own it.
  watch(
    () => route.fullPath,
    () => close(false),
  );

  onBeforeUnmount(() => {
    releaseBody();
    document.removeEventListener("keydown", onKeydown);
  });

  return { open, close };
}
