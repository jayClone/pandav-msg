import dotenv from "dotenv";
import app from "./app.js";
import healthRoutes from "./routes/health.routes.js";

dotenv.config();

app.use("/api", healthRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
