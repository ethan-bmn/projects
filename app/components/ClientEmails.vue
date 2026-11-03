<script setup lang="ts">
defineProps<{ emails: string[], emptyLabel?: string }>()
</script>

<template>
  <ul
    v-if="emails.length"
    aria-label="Adresses e-mail"
    class="space-y-1 text-sm text-muted"
  >
    <li
      v-for="(email, index) in emails"
      :key="index"
      class="wrap-anywhere"
    >
      <a
        :href="`mailto:${email}`"
        class="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
      >{{ email }}</a>
    </li>
  </ul>
  <p
    v-else
    class="text-sm text-muted"
  >
    {{ emptyLabel || 'Aucune adresse e-mail' }}
  </p>
</template>
