<script lang="ts">
	import Image from '$lib/Image.svelte';

	let image: HTMLImageElement | undefined;
	console.log(image?.dataset);
</script>

<h1>Welcome to SvelteKit</h1>
<p>
	Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation
</p>

<Image src="/favicon.png" {image} width={500} height={500} />
