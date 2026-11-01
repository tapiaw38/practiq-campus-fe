import { nextTick, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { useRoute } from "vue-router";

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
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKeydown);
      void nextTick(() => requestAnimationFrame(() => options.panel.value?.focus()));
      return;
    }
    releaseBody();
    document.removeEventListener("keydown", onKeydown);
  });

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
