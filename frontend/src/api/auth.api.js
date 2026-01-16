import API from "./axios";

export const registerUser = async (userData) =>{
    const res = await API.post("/auth/register", userData);
    return res.data;
};

export const login = async (credentials) =>{
    const res = await API.post("/auth/login", credentials);
    return res.data;
};

export const getCurrentUser = async () =>{
    const res = await API.get("/auth/me")
    return res.data
}