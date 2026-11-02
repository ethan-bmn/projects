<script setup lang="ts">
import type { ProjectInput } from '#shared/types/projects'
import type { AbbyQuote } from '#shared/types/quotes'

const props = defineProps<{ clientId: string, initial?: ProjectInput, pending: boolean, error: string }>()
const emit = defineEmits<{ submit: [input: ProjectInput], cancel: [] }>()
const name = ref(props.initial?.name ?? '')
const quoteId = ref(props.initial?.quoteId ?? '__none__')
useUnsavedChanges(() => !props.pending && (name.value !== (props.initial?.name ?? '') || quoteId.value !== (props.initial?.quoteId ?? '__none__')))
const { data: quotes, status, error: quoteError, refresh } = await useFetch<AbbyQuote[]>(`/api/clients/${props.clientId}/quotes`, { server: false, lazy: true })
const quoteErrorMessage = computed(() => (quoteError.value?.data as { message?: string } | undefined)?.message || 'Impossible de récupérer les devis Abby.')
const items = computed(() => [
  { label: 'Aucun devis', value: '__none__' },
  ...(props.initial?.quoteId && !quotes.value?.some(quote => quote.id === props.initial?.quoteId)
    ? [{ label: 'Devis actuellement associé', value: props.initial.quoteId }]
    : []),
  ...(quotes.value ?? []).map(quote => ({
    label: [
      quote.number || 'Brouillon',
      quote.title,
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: quote.currencyCode }).format(quote.amountWithTax / 100)
    ].filter(Boolean).join(' · '),
    value: quote.id
  }))
])
</script>

<template>
  <form
    class="space-y-6"
    @submit.prevent="emit('submit', { name, quoteId: quoteId === '__none__' ? null : quoteId })"
  >
    <UFormField
      label="Nom du projet"
      name="name"
      required
    >
      <UInput
        v-model="name"
        class="w-full"
        :maxlength="200"
        :disabled="pending"
        required
      />
    </UFormField>
    <UFormField
      label="Devis Abby (optionnel)"
      name="quoteId"
    >
      <USelect
        v-model="quoteId"
        :items="items"
        class="w-full"
        :loading="status === 'pending'"
        :disabled="pending || status === 'pending'"
      />
    </UFormField>
    <div
      v-if="quoteError"
      role="alert"
      class="space-y-2 text-sm text-error"
    >
      <p>{{ quoteErrorMessage }}</p>
      <UButton
        label="Réessayer"
        color="neutral"
        variant="outline"
        @click="refresh()"
      />
    </div>
    <p
      v-else-if="status === 'success' && !quotes?.length"
      class="text-sm text-muted"
    >
      Aucun devis disponible pour ce client dans Abby.
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <div class="flex flex-wrap gap-3 border-t border-default pt-5">
      <UButton
        type="submit"
        :label="initial ? 'Enregistrer' : 'Créer le projet'"
        :loading="pending"
      />
      <UButton
        label="Annuler"
        color="neutral"
        variant="ghost"
        :disabled="pending"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
