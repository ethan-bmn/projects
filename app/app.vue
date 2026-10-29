<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

const { loggedIn, user, clear } = useUserSession()
const signingOut = ref(false)

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
    <UHeader
      v-if="loggedIn"
      :toggle="false"
      :ui="{ root: 'h-auto', container: 'h-(--ui-header-height)' }"
    >
      <template #left>
        <NuxtLink
          to="/"
          class="rounded-md p-1 font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-primary"
        >
          Abby Projects
        </NuxtLink>
      </template>

      <template #bottom>
        <UContainer>
          <nav
            aria-label="Navigation principale"
            class="flex gap-1 border-t border-default py-2"
          >
            <UButton
              to="/"
              label="Clients"
              color="neutral"
              variant="ghost"
              exact
            />
            <UButton
              to="/prospects"
              label="Prospects"
              color="neutral"
              variant="ghost"
            />
          </nav>
        </UContainer>
      </template>

      <template #right>
        <span class="hidden text-sm text-muted sm:block">{{ user?.email }}</span>
        <UButton
          to="/settings"
          label="Paramètres"
          aria-label="Paramètres"
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          :ui="{ label: 'hidden sm:inline' }"
        />
        <UColorModeButton />
        <UButton
          label="Se déconnecter"
          aria-label="Se déconnecter"
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          :ui="{ label: 'hidden sm:inline' }"
          :loading="signingOut"
          @click="signOut"
        />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
