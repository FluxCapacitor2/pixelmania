import { Dispatch } from "react";

export const ColorPicker = ({ setColor }: { setColor: Dispatch<string> }) => {
  const colors = [
    "black",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "dodgerblue",
    "purple",
    "pink",
    "white",
  ];

  return (
    <div className="flex gap-2">
      {colors.map((color) => (
        <button
          key={color}
          className={`w-5 h-5 rounded-md ${
            color === "white" && "border-2 border-black"
          }`}
          style={{ backgroundColor: color }}
          onClick={() => setColor(color)}
        />
      ))}
    </div>
  );
};
