<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' });

const { t } = useI18n();
useHead(() => ({ title: t('app.discover.pageTitle') }));
</script>

<template>
  <AppTabPlaceholder
    :title="$t('app.nav.discover')"
    :body="$t('app.discover.placeholder')"
  />
</template>
