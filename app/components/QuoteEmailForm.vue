<script setup lang="ts">
import type { Client } from '#shared/types/clients'
import type { QuoteDelivery, QuoteEmailPreview } from '#shared/types/email'

const props = defineProps<{ client: Client, projectId: string, quoteId: string }>()
const endpoint = computed(() => `/api/clients/${props.client.id}/projects/${props.projectId}/email`)
const to = ref(props.client.emails[0]?.trim().toLowerCase() || '')
const signature = ref('none')
const signatureLink = ref('')
const signerName = ref(props.client.name.slice(0, 100))
const preview = ref<QuoteEmailPreview | null>(null)
const requestId = ref('')
const pending = ref(false)
const hasAttempted = ref(false)
const error = ref('')
const message = ref('')
const history = ref<QuoteDelivery[]>([])
const historyError = ref('')
const recipients = computed(() => [...new Set(props.client.emails.map(email => email.trim().toLowerCase()))])
const signatureOptions = [
  { label: 'Sans demande de signature', value: 'none' },
  { label: 'Créer une demande DocuSign', value: 'docusign' },
  { label: 'Inclure un lien de signature existant', value: 'link' }
]
const statusLabels: Record<QuoteDelivery['status'], string> = { preparing: 'Préparation en cours', sending: 'Envoi en cours', sent: 'Accepté par le serveur SMTP', failed: 'Non envoyé', uncertain: 'Envoi à vérifier' }
const signatureLabels: Record<QuoteDelivery['signatureStatus'], string> = { none: '', pending: 'Signature à envoyer', sending: 'Demande de signature en cours', sent: 'Invitation DocuSign envoyée', failed: 'Demande de signature échouée', uncertain: 'Demande de signature à vérifier dans DocuSign' }

function invalidate() {
  preview.value = null
  requestId.value = ''
  hasAttempted.value = false
  error.value = ''
  message.value = ''
}
watch([to, signature, signatureLink, signerName, () => props.quoteId], invalidate)

async function loadHistory() {
  historyError.value = ''
  try {
    history.value = await $fetch<QuoteDelivery[]>(`${endpoint.value}/history`)
  } catch {
    historyError.value = 'Impossible de charger l’historique. Vérifiez-le avant de renouveler un envoi.'
  }
}
onMounted(loadHistory)

function options() {
  return { to: to.value, docusign: signature.value === 'docusign', signatureLink: signature.value === 'link' ? signatureLink.value : '', signerName: signature.value === 'docusign' ? signerName.value : '' }
}

function failure(cause: unknown) {
  return (cause as { data?: { message?: string } }).data?.message || 'La requête n’a pas abouti. Consultez l’historique avant de réessayer.'
}

async function showPreview() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  message.value = ''
  try {
    preview.value = await $fetch<QuoteEmailPreview>(`${endpoint.value}/preview`, { method: 'POST', body: options() })
    requestId.value = crypto.randomUUID()
    hasAttempted.value = false
  } catch (cause) {
    error.value = failure(cause)
  } finally { pending.value = false }
}

async function send() {
  if (pending.value || !preview.value || !requestId.value) return
  pending.value = true
  error.value = ''
  message.value = ''
  hasAttempted.value = true
  try {
    const result = await $fetch<QuoteDelivery>(`${endpoint.value}/send`, {
      method: 'POST', body: { ...options(), id: requestId.value, previewHash: preview.value.previewHash }
    })
    if (result.status === 'sent') {
      message.value = result.signatureStatus === 'sent' ? 'E-mail accepté par SMTP et invitation DocuSign envoyée.' : 'E-mail accepté par le serveur SMTP.'
      if (result.error) error.value = result.error
    } else error.value = result.error || statusLabels[result.status]
  } catch (cause) {
    error.value = failure(cause)
  } finally {
    await loadHistory()
    pending.value = false
  }
}

async function retrySignature(item: QuoteDelivery) {
  if (pending.value) return
  pending.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await $fetch<QuoteDelivery>(`${endpoint.value}/${item.id}/signature`, { method: 'POST' })
    if (result.signatureStatus === 'sent') message.value = 'Invitation DocuSign envoyée. L’e-mail SMTP n’a pas été renvoyé.'
    else error.value = result.error || signatureLabels[result.signatureStatus]
  } catch (cause) { error.value = failure(cause) } finally {
    await loadHistory()
    pending.value = false
  }
}
</script>

<template>
  <section
    aria-labelledby="quote-email-title"
    class="space-y-4 border-t border-default pt-5"
  >
    <h2
      id="quote-email-title"
      class="text-lg font-semibold text-highlighted"
    >
      Envoyer le devis
    </h2>
    <p class="text-sm text-muted">
      Le PDF officiel Abby sera joint au message. Configurez l’expéditeur et les modèles dans les <NuxtLink
        to="/settings#email"
        class="underline"
      >paramètres e-mail</NuxtLink>.
    </p>
    <p
      v-if="!recipients.length"
      role="status"
      class="text-sm text-muted"
    >
      Aucune adresse e-mail pour ce client. Ajoutez-la dans Abby, puis synchronisez vos clients.
    </p>
    <form
      v-else
      class="space-y-4"
      @submit.prevent="showPreview"
    >
      <fieldset
        :disabled="pending"
        class="space-y-4"
      >
        <UFormField
          label="Destinataire"
          name="quote-recipient"
          required
        >
          <USelect
            v-model="to"
            :items="recipients"
            name="quote-recipient"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Signature électronique"
          name="quote-signature"
        >
          <USelect
            v-model="signature"
            :items="signatureOptions"
            name="quote-signature"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="signature === 'docusign'"
          class="text-sm text-muted"
        >
          DocuSign enverra une seconde invitation avec le lien de signature. Le client placera sa signature sur le PDF. Votre <NuxtLink
            to="/settings#docusign"
            class="underline"
          >compte DocuSign</NuxtLink> doit être connecté.
        </p>
        <UFormField
          v-if="signature === 'docusign'"
          label="Nom complet du signataire"
          name="quote-signer-name"
          description="Pour une entreprise, indiquez la personne qui signera le devis."
          required
        >
          <UInput
            v-model="signerName"
            name="quote-signer-name"
            :maxlength="100"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          v-if="signature === 'link'"
          label="Lien de signature existant"
          name="quote-signature-link"
          required
        >
          <UInput
            v-model="signatureLink"
            name="quote-signature-link"
            type="url"
            placeholder="https://…"
            :maxlength="2000"
            class="w-full"
            required
          />
        </UFormField>
      </fieldset>
      <UButton
        type="submit"
        label="Prévisualiser le message"
        color="neutral"
        variant="outline"
        :loading="pending"
        :disabled="!to"
      />
    </form>
    <div
      v-if="preview"
      class="space-y-4 border-t border-default pt-4"
    >
      <dl class="space-y-2 text-sm wrap-anywhere">
        <div>
          <dt class="text-muted">
            Expéditeur
          </dt><dd>{{ preview.from }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Destinataire
          </dt><dd>{{ preview.to }}</dd>
        </div>
        <div v-if="preview.replyTo">
          <dt class="text-muted">
            Répondre à
          </dt><dd>{{ preview.replyTo }}</dd>
        </div>
        <div v-if="preview.docusign">
          <dt class="text-muted">
            Signataire DocuSign
          </dt><dd>{{ preview.signerName }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Objet
          </dt><dd>{{ preview.subject }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Pièce jointe
          </dt><dd>{{ preview.filename }}</dd>
        </div>
      </dl>
      <p class="text-sm whitespace-pre-wrap wrap-anywhere">
        {{ preview.text }}
      </p>
      <div class="flex flex-wrap gap-3">
        <UButton
          :label="hasAttempted ? 'Vérifier le résultat de cet envoi' : 'Envoyer au client'"
          icon="i-lucide-send"
          :loading="pending"
          :disabled="!!historyError"
          @click="send"
        />
        <UButton
          v-if="hasAttempted"
          label="Préparer un nouvel envoi"
          color="neutral"
          variant="outline"
          :disabled="pending"
          @click="invalidate"
        />
      </div>
    </div>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <p
      v-if="message"
      role="status"
      class="text-sm text-success"
    >
      {{ message }}
    </p>
    <div class="space-y-3 border-t border-default pt-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="font-medium text-highlighted">
          Historique des envois
        </h3>
        <UButton
          label="Actualiser"
          color="neutral"
          variant="ghost"
          :disabled="pending"
          @click="loadHistory"
        />
      </div>
      <p
        v-if="historyError"
        role="alert"
        class="text-sm text-error"
      >
        {{ historyError }}
      </p>
      <p
        v-else-if="!history.length"
        class="text-sm text-muted"
      >
        Aucun envoi pour ce projet.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="item in history"
          :key="item.id"
          class="space-y-2 py-3 text-sm wrap-anywhere"
        >
          <p>{{ item.to }} · {{ new Date(item.createdAt).toLocaleString('fr-FR') }}</p>
          <p>{{ item.subject }}</p>
          <p class="text-muted">
            {{ statusLabels[item.status] }}<template v-if="item.signatureStatus !== 'none'">
              · {{ signatureLabels[item.signatureStatus] }}
            </template>
          </p>
          <p
            v-if="item.error"
            class="text-error"
          >
            {{ item.error }}
          </p>
          <p
            v-if="item.envelopeId"
            class="text-muted"
          >
            Enveloppe DocuSign : {{ item.envelopeId }}
          </p>
          <UButton
            v-if="item.status === 'sent' && ['pending', 'failed'].includes(item.signatureStatus)"
            label="Envoyer l’invitation DocuSign uniquement"
            color="neutral"
            variant="outline"
            :disabled="pending"
            @click="retrySignature(item)"
          />
        </li>
      </ul>
    </div>
  </section>
</template>
