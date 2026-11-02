<script setup lang="ts">
import type { ProjectDetail } from '#shared/types/projects'

const props = defineProps<{ detail: ProjectDetail }>()
const route = useRoute()
const base = computed(() => `/clients/${props.detail.client.id}/projects/${props.detail.project.id}`)
const tabs = computed(() => [
  { label: 'Vue d’ensemble', short: 'Projet', to: base.value },
  { label: 'Devis et signature', short: 'Devis et signature', to: `${base.value}/quote` },
  { label: 'Cahier des charges', short: 'Cahier des charges', to: `${base.value}/specification` }
])
</script>

<template>
  <header class="mb-8">
    <nav
      aria-label="Fil d’Ariane"
      class="flex min-w-0 items-center gap-2 text-sm text-muted"
    >
      <NuxtLink
        to="/"
        class="hover:text-highlighted"
      >Clients</NuxtLink>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-3 shrink-0"
      />
      <NuxtLink
        :to="`/clients/${detail.client.id}`"
        class="truncate hover:text-highlighted"
      >{{ detail.client.name }}</NuxtLink>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-3 shrink-0"
      />
      <span class="shrink-0">Projet</span>
    </nav>
    <div class="mt-5 flex flex-wrap items-start justify-between gap-4">
      <h1 class="min-w-0 text-2xl font-semibold tracking-tight text-highlighted wrap-anywhere">
        {{ detail.project.name }}
      </h1>
      <slot />
    </div>
    <p
      v-if="!detail.client.active"
      class="mt-3 text-sm text-muted"
    >
      Client inactif dans Abby. Ce projet reste accessible.
    </p>
    <nav
      aria-label="Navigation du projet"
      class="mt-6 flex gap-4 border-b border-default sm:gap-6"
    >
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        :aria-current="route.path === tab.to ? 'page' : undefined"
        class="shrink-0 border-b-2 px-0.5 py-3 text-xs font-medium transition-colors sm:text-sm"
        :class="route.path === tab.to ? 'border-primary text-highlighted' : 'border-transparent text-muted hover:text-highlighted'"
      ><span class="sm:hidden">{{ tab.short }}</span><span class="hidden sm:inline">{{ tab.label }}</span></NuxtLink>
    </nav>
  </header>
</template>
