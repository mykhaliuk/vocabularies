<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' });

const { t } = useI18n();
useHead(() => ({ title: t('app.profile.pageTitle') }));
</script>

<template>
  <AppTabPlaceholder
    :title="$t('app.nav.profile')"
    :body="$t('app.profile.placeholder')"
  >
    <!-- The real profile screen is a later ticket; until then the account
         page keeps living at /me and stays reachable from here. -->
    <NuxtLink to="/me">{{ $t('app.profile.accountSettings') }}</NuxtLink>
  </AppTabPlaceholder>
</template>
