<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' });

const { t } = useI18n();
useHead(() => ({ title: t('app.saved.pageTitle') }));
</script>

<template>
  <AppTabPlaceholder
    :title="$t('app.nav.saved')"
    :body="$t('app.saved.placeholder')"
  />
</template>
