<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const sections = [
  { label: 'Vue d’ensemble', to: '/settings', icon: 'i-lucide-sliders-horizontal' },
  { label: 'Connexion Abby', to: '/settings/abby', icon: 'i-lucide-refresh-cw' },
  { label: 'Expéditeur et SMTP', to: '/settings/email', icon: 'i-lucide-mail' },
  { label: 'Modèles d’e-mail', to: '/settings/templates', icon: 'i-lucide-file-text' },
  { label: 'Signature', to: '/settings/signature', icon: 'i-lucide-pen-line' },
  { label: 'Compte et sécurité', to: '/settings/account', icon: 'i-lucide-user-round' }
]
const selectedSection = computed({
  get: () => route.path,
  set: (path: string) => {
    router.push(path)
  }
})
const sectionOptions = sections.map(section => ({ label: section.label, value: section.to }))
useSeoMeta({ title: 'Paramètres | Abby Projects' })
onMounted(() => {
  const legacy: Record<string, string> = { '#abby': 'abby', '#email': 'email', '#documenso': 'signature', '#account': 'account' }
  if (route.path === '/settings' && legacy[route.hash]) router.replace(`/settings/${legacy[route.hash]}`)
})
</script>

<template>
  <UContainer class="py-8 sm:py-10">
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      Paramètres
    </h1>
    <p class="mt-2 text-sm text-muted">
      Configurez vos connexions, vos envois et votre compte.
    </p>
    <div class="mt-8 grid min-w-0 gap-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-12">
      <USelect
        v-model="selectedSection"
        :items="sectionOptions"
        aria-label="Section des paramètres"
        class="w-full md:hidden"
      />
      <nav
        aria-label="Paramètres"
        class="hidden gap-1 md:flex md:flex-col md:self-start"
      >
        <NuxtLink
          v-for="section in sections"
          :key="section.to"
          :to="section.to"
          :aria-current="route.path === section.to ? 'page' : undefined"
          class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors"
          :class="route.path === section.to ? 'bg-muted font-medium text-highlighted' : 'text-muted hover:bg-muted hover:text-highlighted'"
        >
          <UIcon
            :name="section.icon"
            class="size-4 shrink-0"
          />
          {{ section.label }}
        </NuxtLink>
      </nav>
      <div class="min-w-0 max-w-2xl">
        <NuxtPage />
      </div>
    </div>
  </UContainer>
</template>
