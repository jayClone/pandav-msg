import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const API = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers:{
        "Content-Type": "appLication/json"
    }
});

// add token to every request
API.interceptors.request.use((config) =>{
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handles error globally
API.interceptors.response.use(
    (response) => response,
    (error) =>{
        if(error.response?.status === 401){
            localStorage.removeItem("token");
            window.location.href = "/login"
        }
        return Promise.reject(error);
    }
);

export default API;