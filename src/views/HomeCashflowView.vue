<template>
  <main id="main" class="cashflow-page">
    <iframe
      class="cashflow-frame"
      src="/tools/home-cashflow.html"
      title="买房现金流计算器"
      sandbox="allow-scripts"
    />
  </main>
</template>

<style scoped>
.cashflow-page { height: 100svh; background: #1f2126; }
.cashflow-frame { display: block; width: 100%; height: 100%; border: 0; }
</style>
