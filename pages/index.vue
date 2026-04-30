<script setup>
const config = useRuntimeConfig();
</script>

<template>
  <main>
    <h1>hi there</h1>
    <p>vocabu — env: {{ config.public.appEnv }}</p>
  </main>
</template>
