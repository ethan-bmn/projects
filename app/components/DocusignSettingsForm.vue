<script setup lang="ts">
import type { DocusignSettings } from '#shared/types/email'

const route = useRoute()
const { data, error, refresh } = await useFetch<DocusignSettings>('/api/settings/docusign')
const form = ref<DocusignSettings | null>(null)
const clientSecret = ref('')
const pending = ref(false)
const message = ref(route.query.docusign === 'connected' ? 'Compte DocuSign connecté.' : '')
const saveError = ref(route.query.docusign === 'error' ? 'Connexion DocuSign refusée ou expirée. Vérifiez les identifiants et l’URL de retour, puis reconnectez le compte.' : '')
const callbackUrl = `${useRequestURL().origin}/api/docusign/callback`
watch(data, (value) => {
  if (value) form.value = { ...value, redirectUri: value.redirectUri || callbackUrl }
}, { immediate: true })
const environments = [{ label: 'Développement (demo)', value: 'demo' }, { label: 'Production', value: 'production' }]

async function action(kind: 'save' | 'connect' | 'disconnect') {
  if (pending.value || !form.value) return
  pending.value = true
  message.value = ''
  saveError.value = ''
  try {
    if (kind === 'save') {
      data.value = await $fetch<DocusignSettings>('/api/settings/docusign', { method: 'PUT', body: { ...form.value, clientSecret: clientSecret.value } })
      clientSecret.value = ''
      message.value = 'Paramètres enregistrés. Connectez maintenant votre compte DocuSign.'
    } else if (kind === 'connect') {
      const result = await $fetch<{ url: string }>('/api/settings/docusign/connect', { method: 'POST' })
      window.location.assign(result.url)
    } else {
      data.value = await $fetch<DocusignSettings>('/api/settings/docusign/disconnect', { method: 'POST' })
      message.value = 'Compte DocuSign déconnecté de l’app.'
    }
  } catch (cause) {
    saveError.value = (cause as { data?: { message?: string } }).data?.message || 'Impossible de modifier la connexion DocuSign.'
  } finally { pending.value = false }
}
</script>

<template>
  <section
    id="docusign"
    aria-labelledby="docusign-title"
    class="py-8"
  >
    <h2
      id="docusign-title"
      class="text-lg font-semibold text-highlighted"
    >
      Signature DocuSign
    </h2>
    <p class="mt-2 text-sm text-muted">
      Connectez votre compte pour créer une demande de signature à partir du PDF Abby. DocuSign envoie son invitation au client, en plus de votre e-mail SMTP.
    </p>
    <div
      v-if="error"
      class="mt-4 space-y-3"
    >
      <p
        role="alert"
        class="text-sm text-error"
      >
        Impossible de charger les paramètres DocuSign.
      </p>
      <UButton
        label="Réessayer"
        color="neutral"
        variant="outline"
        @click="refresh()"
      />
    </div>
    <form
      v-else-if="form"
      class="mt-5 space-y-4"
      @submit.prevent="action('save')"
    >
      <p
        v-if="data?.connected"
        class="text-sm text-success"
      >
        Compte connecté : {{ data.accountName || 'DocuSign' }} ({{ data.environment === 'demo' ? 'développement' : 'production' }}).
      </p>
      <fieldset
        :disabled="pending"
        class="space-y-4"
      >
        <UFormField
          label="Environnement"
          name="docusign-environment"
        >
          <USelect
            v-model="form.environment"
            :items="environments"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Clé d’intégration (client ID)"
          name="docusign-client-id"
          required
        >
          <UInput
            v-model="form.integrationKey"
            name="docusign-client-id"
            :maxlength="100"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="Clé secrète"
          name="docusign-client-secret"
          :description="form.secretConfigured ? 'Une clé est enregistrée. Laissez vide pour la conserver.' : 'Clé secrète de votre intégration DocuSign.'"
        >
          <UInput
            v-model="clientSecret"
            name="docusign-client-secret"
            type="password"
            autocomplete="new-password"
            :maxlength="4096"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="URL de retour OAuth"
          name="docusign-redirect"
          description="Ajoutez exactement cette URL dans les Redirect URIs de votre intégration DocuSign (Authorization Code Grant)."
          required
        >
          <UInput
            v-model="form.redirectUri"
            name="docusign-redirect"
            type="url"
            class="w-full"
            required
          />
        </UFormField>
        <p class="text-sm text-muted">
          Enregistrer ces paramètres déconnecte le compte actuel. Le client placera sa signature sur le document dans DocuSign (signature libre).
        </p>
      </fieldset>
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
          label="Enregistrer DocuSign"
          :loading="pending"
        />
        <UButton
          type="button"
          :label="data?.connected ? 'Reconnecter le compte' : 'Connecter le compte'"
          color="neutral"
          variant="outline"
          :disabled="pending || !data?.secretConfigured"
          @click="action('connect')"
        />
        <UButton
          v-if="data?.connected"
          type="button"
          label="Déconnecter"
          color="neutral"
          variant="ghost"
          :disabled="pending"
          @click="action('disconnect')"
        />
      </div>
    </form>
  </section>
</template>
