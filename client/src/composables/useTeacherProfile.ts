import { computed, ref } from 'vue'
import { getMe } from '../api/auth'
import { getAccessToken, getStoredUser, updateStoredUser } from '../auth/storage'

export function useTeacherProfile() {
  const storedUser = ref(getStoredUser())

  const profileName = computed(() => {
    const name = storedUser.value?.name?.trim()
    return name ? `${name} 老师` : '老师'
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
