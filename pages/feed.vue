<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' });

const { t } = useI18n();
useHead(() => ({ title: t('app.feed.pageTitle') }));
</script>

<template>
  <AppTabPlaceholder
    :title="$t('app.nav.feed')"
    :body="$t('app.feed.placeholder')"
  />
</template>
