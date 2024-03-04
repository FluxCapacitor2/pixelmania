import { Dispatch } from "react";

export const ColorPicker = ({
  setColor,
}: {
  setColor: Dispatch<string | null>;
}) => {
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
    null,
  ];

  return (
    <div className="flex gap-2">
      {colors.map((color) => (
        <button
          key={color}
          className={`w-5 h-5 rounded-md ${
            color === null && "border-2 border-black"
          }`}
          style={{ backgroundColor: color ?? "transparent" }}
          onClick={() => setColor(color)}
        />
      ))}
    </div>
  );
};
