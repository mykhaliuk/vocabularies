<!-- Pass-through: pre-shell pages (landing, me, offline) render unchanged;
     login opts out of layouts entirely (layout: false), and the authed tabs
     opt into layouts/app.vue via definePageMeta. -->
<template>
  <slot />
</template>
