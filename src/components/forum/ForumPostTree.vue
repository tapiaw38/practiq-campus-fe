<script setup lang="ts">
  import { formatDateTime } from "@/utils/datetime";
  import { computed, ref } from "vue";
  import { useForum } from "@/composables/useForum";
  import type { ForumPost } from "@/types";

  const props = defineProps<{ posts: ForumPost[]; threadId: string; post: ForumPost; depth?: number }>();
  const emit = defineEmits<{ posted: [] }>();
  const { createPost } = useForum();
  const expanded = ref<Record<string, boolean>>({});
  const replyingTo = ref<string | null>(null);
  const drafts = ref<Record<string, string>>({});
  const posting = ref(false);
  const nestedDepth = computed(() => props.depth ?? 0);

  function repliesFor(postId: string) {
    return props.posts
      .filter((post) => post.parent_post_id === postId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  function visibleReplies(postId: string) {
    const replies = repliesFor(postId);
    return expanded.value[postId] ? replies : replies.slice(-2);
  }

  async function submit(postId: string) {
    const body = drafts.value[postId]?.trim();
    if (!body || posting.value) return;
    posting.value = true;
    try {
      await createPost(props.threadId, body, postId);
      drafts.value[postId] = "";
      replyingTo.value = null;
      emit("posted");
    } finally {
      posting.value = false;
    }
  }
</script>

<template>
  <article class="post-node" :class="{ 'post-node--nested': nestedDepth > 0 }">
    <div class="reply-card">
      <div class="reply-meta">
        <span class="reply-avatar">{{ (post.author_name || post.author_id).slice(0, 1).toUpperCase() }}</span>
        <span>{{ post.author_name || post.author_id }}</span>
        <time :datetime="post.created_at">{{ formatDateTime(post.created_at) }}</time>
      </div>
      <p>{{ post.body }}</p>
      <button v-if="replyingTo !== post.id" class="reply-link" type="button" @click="replyingTo = post.id">Responder</button>
      <form v-else class="inline-reply-form" @submit.prevent="submit(post.id)">
        <div class="inline-reply-label">Respuesta a {{ post.author_name || post.author_id }} <button class="cancel-target" type="button" @click="replyingTo = null">Cancelar</button></div>
        <Textarea v-model="drafts[post.id]" rows="3" placeholder="Escribí tu respuesta…" />
          <Button type="submit" label="Publicar respuesta" :loading="posting" size="small" />
      </form>
    </div>

    <div v-if="repliesFor(post.id).length" class="reply-children">
      <button v-if="repliesFor(post.id).length > 2" class="thread-toggle" type="button" @click="expanded[post.id] = !expanded[post.id]">
        <i :class="expanded[post.id] ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i>
        {{ expanded[post.id] ? "Comprimir respuestas" : `Ver ${repliesFor(post.id).length - 2} respuestas anteriores` }}
      </button>
      <ForumPostTree
        v-for="reply in visibleReplies(post.id)"
        :key="reply.id"
        :posts="posts"
        :thread-id="threadId"
        :post="reply"
        :depth="nestedDepth + 1"
        @posted="emit('posted')"
      />
    </div>
  </article>
</template>

<style scoped>
  .post-node { min-width: 0; margin-bottom: var(--space-3); }
  .post-node--nested { margin-bottom: 0; }
  .reply-card { padding: var(--space-4); background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: var(--radius-md); }
  .reply-meta { display: flex; align-items: center; gap: var(--space-2); color: var(--text-muted); font-size: var(--text-xs); }
  .reply-meta time { margin-left: auto; }
  .reply-avatar { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--fill-primary-soft); color: var(--practiq-violet-dark); font-weight: 700; }
  .reply-card p { margin: var(--space-3) 0 0; color: var(--text-primary); line-height: 1.55; white-space: pre-wrap; }
  .reply-link, .cancel-target, .thread-toggle { border: 0; background: transparent; color: var(--practiq-violet-dark); font-size: var(--text-xs); font-weight: 700; cursor: pointer; padding: 0; }
  .reply-link { margin-top: var(--space-3); }
  .cancel-target { color: var(--text-muted); font-weight: 600; }
  .inline-reply-form { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-3); padding: var(--space-3); border-left: 3px solid var(--practiq-violet); background: var(--surface-hover); border-radius: 0 var(--radius-md) var(--radius-md) 0; }
  .inline-reply-label { display: flex; justify-content: space-between; gap: var(--space-2); color: var(--text-secondary); font-size: var(--text-xs); font-weight: 700; }
  .inline-reply-form .p-button { align-self: flex-start; }
  .reply-children { position: relative; display: grid; gap: var(--space-2); margin: var(--space-2) 0 0 var(--space-4); padding: var(--space-2) 0 0 var(--space-4); border-left: 1px solid var(--fill-primary-soft); }
  .reply-children > .post-node { position: relative; }
  .reply-children > .post-node::before { content: ""; position: absolute; top: 27px; left: calc(-1 * var(--space-4)); width: var(--space-4); border-top: 1px solid var(--fill-primary-soft); }
  .thread-toggle { justify-self: start; display: inline-flex; gap: var(--space-1); align-items: center; margin-bottom: var(--space-1); color: var(--text-secondary); }
  .thread-toggle:hover, .reply-link:hover { color: var(--practiq-violet); text-decoration: underline; }
  @media (max-width: 600px) { .reply-meta { flex-wrap: wrap; } .reply-meta time { width: 100%; margin-left: 34px; } .reply-children { margin-left: var(--space-2); padding-left: var(--space-3); } .reply-children > .post-node::before { left: calc(-1 * var(--space-3)); width: var(--space-3); } }
</style>
