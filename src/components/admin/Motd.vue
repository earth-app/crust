<template>
	<div class="flex flex-col gap-3">
		<div>
			<h2 class="text-xl font-semibold">Message of the Day</h2>
			<p class="text-sm text-muted mt-1">Shown to all users in the global NavBar banner.</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<UFormField label="Message">
				<UInput
					v-model="motd.motd"
					placeholder="Set the Message of the Day..."
					:disabled="loading"
				/>
			</UFormField>
			<UFormField label="Icon">
				<UInput
					v-model="motd.icon"
					:icon="motd.icon"
					placeholder="mdi:earth"
					:disabled="loading"
				/>
			</UFormField>
			<UFormField label="Type">
				<USelect
					v-model="motd.type"
					:items="[
						{ label: 'Info', value: 'info', icon: 'mdi:information' },
						{ label: 'Success', value: 'success', icon: 'mdi:check-circle' },
						{ label: 'Warning', value: 'warning', icon: 'mdi:alert' },
						{ label: 'Error', value: 'error', icon: 'mdi:close-circle' }
					]"
					:disabled="loading"
				/>
			</UFormField>
			<UFormField label="Link (optional)">
				<UInput
					v-model="motd.link"
					placeholder="https://..."
					:disabled="loading"
				/>
			</UFormField>
			<UFormField
				label="TTL (seconds)"
				class="md:col-span-2"
				help="How long the banner stays visible. Minimum 300s (5 minutes)."
			>
				<UInput
					v-model.number="ttl"
					type="number"
					:min="300"
					:disabled="loading"
				/>
			</UFormField>
		</div>

		<UButton
			color="primary"
			icon="mdi:send"
			class="self-start"
			@click="handleUpdate"
			:loading="loading"
		>
			Publish MOTD
		</UButton>
	</div>
</template>

<script setup lang="ts">
const { motd, ttl, fetchMotd, setMotd } = useMotd();
const toast = useToast();
const loading = ref(false);

onMounted(fetchMotd);

async function handleUpdate() {
	loading.value = true;
	try {
		await setMotd(motd.value.motd, motd.value.icon, motd.value.type, motd.value.link, ttl.value);
		await fetchMotd();
		toast.add({
			title: 'MOTD Updated',
			description: 'Now visible site-wide.',
			icon: 'mdi:check-circle',
			color: 'success',
			duration: 3000
		});
	} finally {
		loading.value = false;
	}
}
</script>
