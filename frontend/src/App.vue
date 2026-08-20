<template>
  <MainLayout />
  <MessageProvider />
  <Modal
    :visible="modalState.visible"
    :title="modalState.title"
    :content="modalState.content"
    :confirm-text="modalState.confirmText"
    :cancel-text="modalState.cancelText"
    :show-cancel="modalState.showCancel"
    :confirm-disabled="modalState.confirmDisabled"
    @confirm="resolveModal(true)"
    @cancel="resolveModal(false)"
  />
  <InputModal
    :visible="inputModalState.visible"
    :title="inputModalState.title"
    :content="inputModalState.content"
    :placeholder="inputModalState.placeholder"
    :confirm-placeholder="inputModalState.confirmPlaceholder"
    :type="inputModalState.inputType"
    :confirm-input="inputModalState.confirmInput"
    :error="inputModalState.error"
    :model-value="inputModalState.value"
    :confirm-model-value="inputModalState.confirmValue"
    @update:model-value="inputModalState.value = $event"
    @update:confirm-model-value="inputModalState.confirmValue = $event"
    @confirm="resolveInputModal(true)"
    @cancel="resolveInputModal(false)"
  />
</template>
<script setup>
import MainLayout from "@/layouts/MainLayout.vue";
import Modal from "@/components/ui/Modal.vue";
import MessageProvider from "@/components/ui/MessageProvider.vue";
import { modalState, resolveModal } from "@/composables/useModal";

import InputModal from "@/components/ui/InputModal.vue";
import { inputModalState, resolveInputModal } from "@/composables/useInputModal";
</script>
