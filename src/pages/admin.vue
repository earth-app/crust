<template>
	<div class="container mx-auto px-4 py-8">
		<h1 class="text-2xl">Users</h1>
		<div class="mt-4">
			<button
				class="btn btn-primary"
				@click="fetchUsers"
				:disabled="loading"
			>
				{{ loading ? 'Loading...' : 'Fetch Users' }}
			</button>
			<div
				v-if="loading"
				class="mt-2 text-gray-500"
			>
				Loading users...
			</div>
			<ul class="mt-4 space-y-2">
				<li
					v-for="user in users"
					:key="user.id"
					class="p-2 border hover:bg-secondary-900"
				>
					<div class="flex items-center justify-between">
						<UserDropdown
							:user="user"
							admin
							mode="hover"
						>
							<span class="text-lg font-semibold">{{ user.username }}</span>
						</UserDropdown>
					</div>
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import { getUsers } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Admin Panel');

const users = ref<User[]>([]);
const loading = ref(false);

async function fetchUsers() {
	loading.value = true;
	users.value = await getUsers();
	loading.value = false;
}
</script>
