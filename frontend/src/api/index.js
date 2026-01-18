import authApi from "./auth.api.js"
import messageApi from "./message.api.js"

export { authApi, messageApi }

const API = {
  auth: authApi,
  messages: messageApi,
}

export default API