<script setup lang="ts">
import type { NuxtError } from '#app'
import { fr } from '@nuxt/ui/locale'

const props = defineProps<{ error: NuxtError }>()
const title = computed(() => props.error.statusCode === 404 ? 'Page introuvable' : 'Une erreur est survenue')
const description = computed(() => props.error.statusCode === 404
  ? 'La page demandée n’existe pas.'
  : 'Impossible d’afficher cette page. Veuillez réessayer.')

useHead({ htmlAttrs: { lang: 'fr' } })
useSeoMeta({ title: () => `${title.value} | Abby Projects` })
</script>

<template>
  <UApp :locale="fr">
    <UError
      :error="{ statusCode: error.statusCode, statusMessage: title, message: description }"
      :ui="{ statusCode: 'text-sm font-medium text-muted', statusMessage: 'text-2xl font-semibold tracking-tight' }"
    />
  </UApp>
</template>
