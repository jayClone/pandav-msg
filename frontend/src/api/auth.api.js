import API from "./axios";

export const registerUser = async (payload) =>{
    const res = await API.post("/api/auth/register", payload);
    return res.data;
};

export const login = async (payload) =>{
    const res = await API.post("/api/auth/login", payload);
    return res.data;
};