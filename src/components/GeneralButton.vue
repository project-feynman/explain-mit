<template>
  <button @click="$emit('click')">
    <slot>
    
    </slot>
  </button>
</template>

<style scoped>
button {
  font-size: 1rem;
}
</style>