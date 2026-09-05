import AppRoutes from "@routes/AppRoutes";
import UpdateChecker from "@components/UpdateChecker";

function App() {
  return (
    <>
      <UpdateChecker />
      <AppRoutes />
    </>
  );
}

export default App;
