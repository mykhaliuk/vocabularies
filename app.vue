<script setup>
// Keeps <html lang>/dir in sync with the active i18n locale. SEO alternate
// links are skipped: routing is `no_prefix` (single URL per page), so there
// are no per-locale URLs to link between.
useHead(useLocaleHead({ dir: true, lang: true, seo: false }));
</script>

<template>
  <NuxtPage />
</template>
