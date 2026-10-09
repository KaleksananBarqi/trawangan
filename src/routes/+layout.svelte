<script lang="ts">
  import '../styles/theme.css';
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
