import { Toaster } from "react-hot-toast";
import "./App.css";
import { Canvas } from "./components/Canvas";

function App() {
  return (
    <>
      <Toaster position="bottom-center" />
      <h1 className="font-mono text-2xl font-bold text-center mb-4">
        PixelMania
      </h1>
      <main className="flex justify-center items-center gap-4">
        <Canvas />
      </main>
    </>
  );
}

export default App;
