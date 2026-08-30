<script setup lang="ts">
  import { computed } from "vue";
  import type { SubmissionAttachment } from "@/types";

  /**
   * A submission's body plus the files that came with it.
   *
   * Attached files are not a field of their own: the submit form uploads the
   * file and appends its bucket URL to the free-text body. That URL points at a
   * private bucket, so on its own it is unopenable, and both this screen and
   * the grading screen used to print it as plain text — the teacher saw a dead
   * URL they could not even click. The API now returns the same files as
   * `attachments`, each with a short-lived signed `view_url`, and this renders
   * them as real links.
   */
  const props = defineProps<{
    content: string;
    attachments?: SubmissionAttachment[];
  }>();

  const attachments = computed(() => props.attachments ?? []);

  const MARKER = "Archivo adjunto:";

  /**
   * The body with the lines that produced an attachment removed, so the file
   * is not shown twice — once as a chip and once as the raw URL that put it
   * there. Only lines matching a resolved attachment are dropped: when the API
   * returns none (storage unconfigured, or a link the student typed), the text
   * is left exactly as written rather than silently swallowing it.
   */
  const bodyText = computed(() => {
    const urls = new Set(attachments.value.map((attachment) => attachment.url));
    if (!urls.size) return props.content.trim();

    const lines = props.content.split("\n");
    const kept: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const isMarker = line.trimStart().startsWith(MARKER);
      const nextLine = lines[index + 1] ?? "";
      if (isMarker && [...urls].some((url) => nextLine.includes(url))) {
        index += 1;
        continue;
      }
      if ([...urls].some((url) => line.includes(url))) continue;
      kept.push(line);
    }
    return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  });

  type Segment = { text: string; href?: string };

  /**
   * The submit form invites a "link de entrega", and a pasted link was dead
   * text too. Segments are built by hand rather than with v-html: the body is
   * whatever the student typed, and only http(s) becomes a link, so no
   * javascript: URL can ride in on it.
   */
  const segments = computed<Segment[]>(() =>
    bodyText.value.split(/(\s+)/).map((token) => {
      const trimmed = token.replace(/[.,;:)\]]+$/, "");
      const isLink = /^https?:\/\/\S+$/i.test(trimmed);
      return isLink ? { text: token, href: trimmed } : { text: token };
    }),
  );
</script>

<template>
  <div class="submission-body">
    <p v-if="bodyText" class="submission-body__text">
      <template v-for="(segment, index) in segments" :key="index">
        <a
          v-if="segment.href"
          :href="segment.href"
          target="_blank"
          rel="noopener noreferrer"
          >{{ segment.text }}</a
        ><template v-else>{{ segment.text }}</template>
      </template>
    </p>

    <ul v-if="attachments.length" class="submission-body__files">
      <li v-for="attachment in attachments" :key="attachment.url">
        <a :href="attachment.view_url" target="_blank" rel="noopener noreferrer">
          <i class="pi pi-paperclip" aria-hidden="true"></i>
          <span>{{ attachment.filename }}</span>
          <i class="pi pi-external-link" aria-hidden="true"></i>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
  .submission-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .submission-body__text {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .submission-body__text a {
    color: var(--practiq-violet-dark);
    font-weight: 600;
    text-decoration: underline;
  }

  .submission-body__files {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .submission-body__files a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 100%;
    min-height: 34px;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-pill);
    background: var(--fill-primary-subtle);
    color: var(--practiq-violet-dark);
    font-size: var(--text-xs);
    font-weight: 700;
    transition: var(--transition-fast);
  }

  .submission-body__files a:hover {
    border-color: var(--practiq-violet-light);
    background: var(--fill-primary-soft);
  }

  .submission-body__files span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
