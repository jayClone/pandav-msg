import authApi from "@api/auth.api.js"
import messageApi from "@api/message.api.js"

export { authApi, messageApi }

const API = {
  auth: authApi,
  messages: messageApi,
}

export default API