<script setup lang="ts">
import { emailVariables } from '#shared/types/email'
import type { EmailSettings } from '#shared/types/email'

const { data, error, refresh } = await useFetch<EmailSettings>('/api/settings/email')
const form = ref<EmailSettings | null>(null)
const password = ref('')
const pending = ref(false)
const message = ref('')
const saveError = ref('')
watch(data, (value) => {
  if (value) form.value = { ...value }
}, { immediate: true })
const securityOptions = [{ label: 'STARTTLS (généralement port 587)', value: 'starttls' }, { label: 'TLS (généralement port 465)', value: 'tls' }]

async function save() {
  if (pending.value || !form.value) return
  pending.value = true
  saveError.value = ''
  message.value = ''
  try {
    data.value = await $fetch<EmailSettings>('/api/settings/email', { method: 'PUT', body: { ...form.value, smtpPort: Number(form.value.smtpPort), smtpPassword: password.value } })
    password.value = ''
    message.value = 'Paramètres e-mail enregistrés.'
  } catch (cause) {
    saveError.value = (cause as { data?: { message?: string } }).data?.message || 'Impossible d’enregistrer les paramètres e-mail.'
  } finally { pending.value = false }
}

async function verify() {
  if (pending.value) return
  pending.value = true
  saveError.value = ''
  message.value = ''
  try {
    await $fetch('/api/settings/email/verify', { method: 'POST' })
    message.value = 'Connexion SMTP vérifiée. Aucun e-mail n’a été envoyé.'
  } catch (cause) {
    saveError.value = (cause as { data?: { message?: string } }).data?.message || 'Impossible de vérifier la connexion SMTP.'
  } finally { pending.value = false }
}
</script>

<template>
  <section
    id="email"
    aria-labelledby="email-title"
    class="py-8"
  >
    <h2
      id="email-title"
      class="text-lg font-semibold text-highlighted"
    >
      Envoi des devis
    </h2>
    <p class="mt-2 text-sm text-muted">
      Configurez votre expéditeur et le message envoyé avec le PDF Abby. La connexion SMTP utilise TLS.
    </p>
    <div
      v-if="error"
      class="mt-4 space-y-3"
    >
      <p
        role="alert"
        class="text-sm text-error"
      >
        Impossible de charger les paramètres e-mail.
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
      class="mt-5 space-y-5"
      @submit.prevent="save"
    >
      <fieldset
        :disabled="pending"
        class="space-y-4"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Serveur SMTP"
            name="smtp-host"
          >
            <UInput
              v-model="form.smtpHost"
              name="smtp-host"
              placeholder="smtp.example.com"
              :maxlength="253"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Port SMTP"
            name="smtp-port"
            required
          >
            <UInput
              v-model="form.smtpPort"
              name="smtp-port"
              type="number"
              :min="1"
              :max="65535"
              class="w-full"
              required
            />
          </UFormField>
        </div>
        <UFormField
          label="Chiffrement"
          name="smtp-security"
        >
          <USelect
            v-model="form.smtpSecurity"
            :items="securityOptions"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Identifiant SMTP"
          name="smtp-username"
          description="Laissez vide si votre relais SMTP ne demande pas d’authentification."
        >
          <UInput
            v-model="form.smtpUsername"
            name="smtp-username"
            autocomplete="off"
            :maxlength="320"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Mot de passe SMTP"
          name="smtp-password"
          :description="form.smtpPasswordConfigured ? 'Un mot de passe est enregistré. Laissez vide pour le conserver.' : 'Saisissez le mot de passe ou mot de passe d’application de votre messagerie.'"
        >
          <UInput
            v-model="password"
            name="smtp-password"
            type="password"
            autocomplete="new-password"
            :maxlength="4096"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Nom de l’expéditeur"
            name="email-from-name"
          >
            <UInput
              v-model="form.fromName"
              name="email-from-name"
              :maxlength="200"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Adresse de l’expéditeur"
            name="email-from"
          >
            <UInput
              v-model="form.fromEmail"
              name="email-from"
              type="email"
              :maxlength="254"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Adresse de réponse (optionnelle)"
          name="email-reply-to"
        >
          <UInput
            v-model="form.replyTo"
            name="email-reply-to"
            type="email"
            :maxlength="254"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Objet du message"
          name="email-subject"
          required
        >
          <UInput
            v-model="form.subjectTemplate"
            name="email-subject"
            :maxlength="250"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="Texte du message"
          name="email-body"
          required
        >
          <UTextarea
            v-model="form.bodyTemplate"
            name="email-body"
            :rows="10"
            :maxlength="10000"
            class="w-full"
            required
          />
        </UFormField>
        <div class="space-y-2 text-sm text-muted">
          <p>Variables disponibles (respectez les majuscules) :</p>
          <ul class="flex flex-wrap gap-x-4 gap-y-2">
            <li
              v-for="variable in emailVariables"
              :key="variable"
            >
              <code>{{ '${' + variable + '}' }}</code>
            </li>
          </ul>
          <p>SIGNATURE_LINK est vide si aucun lien existant n’est ajouté. L’aperçu du devis affiche le message final avant l’envoi.</p>
          <p>Pour DocuSign, l’objet généré doit rester sous 100 caractères et le message sous 10 000 caractères.</p>
        </div>
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
          label="Enregistrer les paramètres e-mail"
          :loading="pending"
        />
        <UButton
          type="button"
          label="Vérifier la connexion enregistrée"
          color="neutral"
          variant="outline"
          :disabled="pending || !data?.configured"
          @click="verify"
        />
      </div>
    </form>
  </section>
</template>
