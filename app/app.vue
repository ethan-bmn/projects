<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

const { loggedIn, user, clear } = useUserSession()
const route = useRoute()
const signingOut = ref(false)
const navigation = [
  { label: 'Clients', to: '/', icon: 'i-lucide-users', active: () => route.path === '/' || route.path.startsWith('/clients/') },
  { label: 'Prospects', to: '/prospects', icon: 'i-lucide-contact-round', active: () => route.path.startsWith('/prospects') },
  { label: 'Paramètres', to: '/settings', icon: 'i-lucide-settings', active: () => route.path.startsWith('/settings') }
]

async function signOut() {
  signingOut.value = true
  try {
    await clear()
    await navigateTo('/auth', { replace: true })
  } finally {
    signingOut.value = false
  }
}

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  htmlAttrs: { lang: 'fr' }
})

useSeoMeta({
  title: 'Abby Projects',
  description: 'Gestion privée des clients et des cahiers des charges de leurs projets.'
})
</script>

<template>
  <UApp :locale="fr">
    <header
      v-if="loggedIn"
      class="border-b border-default bg-default"
    >
      <UContainer class="flex flex-wrap items-center gap-x-8">
        <NuxtLink
          to="/"
          class="flex h-16 items-center gap-2 font-semibold tracking-tight text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <UIcon
            name="i-lucide-folders"
            class="size-5"
          />
          Abby Projects
        </NuxtLink>
        <nav
          aria-label="Navigation principale"
          class="order-3 flex w-full gap-6 overflow-x-auto md:order-0 md:w-auto"
        >
          <NuxtLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            :aria-current="item.active() ? 'page' : undefined"
            class="flex shrink-0 items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors md:py-5"
            :class="item.active() ? 'border-primary text-highlighted' : 'border-transparent text-muted hover:text-highlighted'"
          >
            <UIcon
              :name="item.icon"
              class="hidden size-4 sm:block"
            />
            {{ item.label }}
          </NuxtLink>
        </nav>
        <div class="ml-auto flex items-center gap-1">
          <span class="mr-3 hidden max-w-48 truncate text-sm text-muted xl:block">{{ user?.email }}</span>
          <UColorModeButton />
          <UButton
            aria-label="Se déconnecter"
            title="Se déconnecter"
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            :loading="signingOut"
            @click="signOut"
          />
        </div>
      </UContainer>
    </header>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
