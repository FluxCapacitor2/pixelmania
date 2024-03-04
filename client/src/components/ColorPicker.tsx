import { Dispatch } from "react";

export const ColorPicker = ({
  color: current,
  setColor,
}: {
  color: string | null;
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
          className={`border-2 w-5 h-5 rounded-md ${
            color === null || color === current
              ? "border-black"
              : "border-transparent"
          }`}
          style={{ backgroundColor: color ?? "transparent" }}
          onClick={() => setColor(color)}
        />
      ))}
    </div>
  );
};
