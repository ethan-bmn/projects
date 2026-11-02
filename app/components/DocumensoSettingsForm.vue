<script setup lang="ts">
import type { DocumensoSettings } from '#shared/types/email'

const { data, error, refresh } = await useFetch<DocumensoSettings>('/api/settings/documenso')
const apiToken = ref('')
const pending = ref(false)
const message = ref('')
const saveError = ref('')

async function save(disconnect = false) {
  if (pending.value) return
  pending.value = true
  message.value = ''
  saveError.value = ''
  try {
    data.value = await $fetch<DocumensoSettings>('/api/settings/documenso', {
      method: 'PUT', body: { apiToken: disconnect ? '' : apiToken.value, disconnect }
    })
    apiToken.value = ''
    message.value = disconnect ? 'Clé API supprimée de l’app.' : 'Clé API enregistrée.'
  } catch (cause) {
    saveError.value = (cause as { data?: { message?: string } }).data?.message || 'Impossible de modifier la connexion Documenso.'
  } finally { pending.value = false }
}
</script>

<template>
  <section
    id="documenso"
    aria-labelledby="documenso-title"
    class="py-8"
  >
    <h2
      id="documenso-title"
      class="text-lg font-semibold text-highlighted"
    >
      Signature Documenso
    </h2>
    <p class="mt-2 text-sm text-muted">
      Créez une clé API dans les paramètres de votre équipe Documenso pour envoyer les devis à signer.
      Le client recevra une invitation avec le devis original et un feuillet de signature.
    </p>
    <div
      v-if="error"
      class="mt-4 space-y-3"
    >
      <p
        role="alert"
        class="text-sm text-error"
      >
        Impossible de charger les paramètres Documenso.
      </p>
      <UButton
        label="Réessayer"
        color="neutral"
        variant="outline"
        @click="refresh()"
      />
    </div>
    <form
      v-else-if="data"
      class="mt-5 space-y-4"
      @submit.prevent="save()"
    >
      <UButton
        :to="data.url"
        target="_blank"
        rel="noopener noreferrer"
        label="Ouvrir Documenso"
        icon="i-lucide-external-link"
        color="neutral"
        variant="outline"
      />
      <UFormField
        label="Clé API"
        name="documenso-api-token"
        :description="data.configured ? 'Une clé est enregistrée. Laissez vide pour la conserver.' : 'Clé créée dans Documenso, commençant par api_. Elle sera conservée chiffrée.'"
      >
        <UInput
          v-model="apiToken"
          name="documenso-api-token"
          type="password"
          autocomplete="new-password"
          :maxlength="4096"
          :disabled="pending"
          class="w-full"
        />
      </UFormField>
      <p
        v-if="saveError"
        role="alert"
        class="text-sm text-error"
      >
        {{ saveError }}
      </p>
      <p
        v-if="message"
        role="status"
        class="text-sm text-success"
      >
        {{ message }}
      </p>
      <div class="flex flex-wrap gap-3">
        <UButton
          type="submit"
          label="Enregistrer la clé"
          :loading="pending"
          :disabled="!apiToken"
        />
        <UButton
          v-if="data.configured"
          type="button"
          label="Supprimer la clé"
          color="neutral"
          variant="outline"
          :disabled="pending"
          @click="save(true)"
        />
      </div>
    </form>
  </section>
</template>
