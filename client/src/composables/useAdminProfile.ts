import { computed, ref } from 'vue'
import { getMe } from '../api/auth'
import { getAccessToken, getStoredUser, updateStoredUser } from '../auth/storage'

export function useAdminProfile() {
  const storedUser = ref(getStoredUser())

  const profileName = computed(() => {
    const name = storedUser.value?.name?.trim()
    return name ? `${name} 管理员` : '管理员'
  })

  const profileAccount = computed(() => storedUser.value?.account ?? '--')

  const refreshProfile = async () => {
    const token = getAccessToken()
    if (!token) return
    try {
      const response = await getMe(token)
      if (response?.data) {
        updateStoredUser(response.data)
        storedUser.value = getStoredUser()
      }
    } catch {
      // ignore
    }
  }

  return {
    storedUser,
    profileName,
    profileAccount,
    refreshProfile,
  }
}
