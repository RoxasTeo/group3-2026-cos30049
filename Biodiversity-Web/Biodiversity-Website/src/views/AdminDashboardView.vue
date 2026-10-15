<script setup>
import { ref, onMounted, computed } from 'vue'
import { request } from '../services/authService'

const usersList = ref([])
const search = ref('')
const selectedRoleFilter = ref('')
const loading = ref(true)
const feedbackMessage = ref('')
const feedbackError = ref('')

// Roles available inside the Niah Biodiversity System
const rolesList = ['conservation_officer', 'botanist', 'user']

onMounted(async () => {
    await fetchUsers()
})

const formatRoleLabel = (roleKey) => {
    const labelsMap = {
        conservation_officer: 'Conservation Officer',
        botanist: 'Field Botanist',
        user: 'General User'
    }
    return labelsMap[roleKey] || roleKey
}

async function fetchUsers() {
    try {
        const data = await request('/api/get_users.php')
        usersList.value = data
    } catch (err) {
        feedbackError.value = err.message || 'Failed to retrieve system user lists.'
    } finally {
        loading.value = false
    }
}

// Triggers an immediate server mutation when the dropdown changes
async function changeUserRole(userId, newRole) {
    feedbackMessage.value = ''
    feedbackError.value = ''

    try {
        const response = await request('/api/update_user_role.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, role: newRole })
        })
        feedbackMessage.value = response.message || 'User profile updated successfully.'
        await fetchUsers() // Reload active lists parameters to sync state
    } catch (err) {
        feedbackError.value = err.message || 'Failed to complete role modification.'
        await fetchUsers() // Rollback dropdown state components visually on error
    }
}

async function toggleUserStatusAction(userItem) {
    const statusPromptText = userItem.is_active ? 'deactivate and suspend' : 're-activate';
    if (!window.confirm(`Are you certain you want to ${statusPromptText} the profile for ${userItem.name}?`)) {
        return
    }

    feedbackMessage.value = ''
    feedbackError.value = ''
    try {
        const response = await request('/api/deactivate_user.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userItem.id })
        })
        feedbackMessage.value = response.message || 'User status updated successfully.'
        await fetchUsers() // Instantly re-syncs state summary counters and grid visual flags
    } catch (err) {
        feedbackError.value = err.message || 'Failed to toggle user profile status.'
    }
}

const filteredUsers = computed(() => {
    if (!usersList.value) return []
    const query = search.value.trim().toLowerCase()

    return usersList.value.filter(u => {
        const matchesSearch = !query || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
        const matchesRole = !selectedRoleFilter.value || u.role === selectedRoleFilter.value
        return matchesSearch && matchesRole
    })
})
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">ADMINISTRATIVE UTILITY SHELL</p>
            <h1>User Profile Management</h1>
            <p>Edit Roles, Add new Users or Remove Existing Account</p>
        </div>
        <RouterLink class="button primary" to="/admin/users/add">+ Add Users</RouterLink>
    </div>
    <div class="panel page-heading">
        <p v-if="feedbackMessage" class="alert success" role="alert">✅ {{ feedbackMessage }}</p>
        <p v-if="feedbackError" class="alert error" role="alert">❌ {{ feedbackError }}</p>
    </div>
    <section class="panel">   
        <div v-if="loading" class="alert info">Compiling directory assets...</div>
        <template v-else>
            <!-- Filters Interface Header Control Panel -->
            <div class="filters">
                <label class="search">
                    Filter Accounts
                    <input v-model="search" type="search" placeholder="Search by name or email address...">
                </label>

                <label>
                    System Role Permissions
                    <select v-model="selectedRoleFilter">
                        <option value="">All account roles</option>
                        <option v-for="r in rolesList" :key="r" :value="r">{{ r }}</option>
                    </select>
                </label>

                <button class="button subtle" @click="search = ''; selectedRoleFilter = ''">Clear Filters</button>
            </div>

            <div class="result-count" role="status">
                {{ filteredUsers.length }} of {{ usersList.value?.length || usersList.value === undefined ?
                    usersList.length : 0 }} account profiles found
            </div>

            <!-- Tabular Prose Data Layout Representation -->
            <div class="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>User Name</th>
                            <th>Email Address</th>
                            <th>System Level Access Role</th>
                            <th>Status Badge</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="userItem in filteredUsers" :key="userItem.id">
                            <td class="username-cell"><strong>{{ userItem.name }}</strong></td>
                            <td>{{ userItem.email }}</td>
                            <td>
                                <select :value="userItem.role" class="role-selector-input"
                                    @change="changeUserRole(userItem.id, $event.target.value)">
                                    <option v-for="roleOption in rolesList" :key="roleOption" :value="roleOption">
                                        {{ formatRoleLabel(roleOption) }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <span :class="['status-pill', userItem.is_active ? 'active-user' : 'inactive-user']">
                                    {{ userItem.is_active ? 'Active Profile' : 'Suspended' }}
                                </span>
                            </td>
                            <td>
                                <button type="button"
                                    :class="['button', 'status-toggle-btn', userItem.is_active ? 'active-green' : 'suspended-red']"
                                    @click="toggleUserStatusAction(userItem)">
                                    {{ userItem.is_active ? 'Deactivate' : 'Activate' }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Empty Result Traps Interface -->
            <div v-if="!filteredUsers.length" class="empty">
                <h2>No account matches discovered</h2>
                <p>Try refining your name queries or clear active filtering options.</p>
            </div>
        </template>
    </section>
</template>
