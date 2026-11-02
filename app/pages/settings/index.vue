<script setup lang="ts">
import type { GlobalSettings } from '#shared/types/settings'
import type { EmailSettings, DocumensoSettings } from '#shared/types/email'

const { data: settings } = await useFetch<GlobalSettings>('/api/settings')
const { data: mail } = await useFetch<EmailSettings>('/api/settings/email')
const { data: signature } = await useFetch<DocumensoSettings>('/api/settings/documenso')
const services = computed(() => [
  { title: 'Connexion Abby', description: 'Synchronisation des clients et récupération des devis.', to: '/settings/abby', status: settings.value ? settings.value.abbyConfigured ? 'Configurée' : 'À configurer' : 'État indisponible' },
  { title: 'Expéditeur et SMTP', description: 'Serveur d’envoi, identité et adresse de réponse.', to: '/settings/email', status: mail.value ? mail.value.configured ? 'Configuré' : 'À configurer' : 'État indisponible' },
  { title: 'Modèles d’e-mail', description: 'Objet et message accompagnant vos devis.', to: '/settings/templates', status: 'Personnaliser' },
  { title: 'Signature Documenso', description: 'Clé API et accès à votre espace de signature.', to: '/settings/signature', status: signature.value ? signature.value.configured ? 'Clé enregistrée' : 'À configurer' : 'État indisponible' },
  { title: 'Compte et sécurité', description: settings.value?.email || 'Adresse de connexion et mot de passe.', to: '/settings/account', status: 'Modifier' }
])
</script>

<template>
  <section aria-labelledby="settings-overview">
    <h2
      id="settings-overview"
      class="text-lg font-semibold text-highlighted"
    >
      Vos réglages
    </h2>
    <ul class="mt-5 divide-y divide-default border-y border-default">
      <li
        v-for="service in services"
        :key="service.to"
      >
        <NuxtLink
          :to="service.to"
          class="group flex items-center justify-between gap-4 py-5"
        >
          <div class="min-w-0">
            <h3 class="font-medium text-highlighted group-hover:underline">{{ service.title }}</h3>
            <p class="mt-1 text-sm text-muted wrap-anywhere">{{ service.description }}</p>
            <p class="mt-2 text-xs text-muted">{{ service.status }}</p>
          </div>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 shrink-0 text-muted"
          />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
