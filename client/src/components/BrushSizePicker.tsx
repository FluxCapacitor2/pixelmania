import { Dispatch } from "react";

export const BrushSizePicker = ({
  thickness,
  setThickness,
}: {
  thickness: number;
  setThickness: Dispatch<number>;
}) => {
  const thicknesses = [1, 2, 3];
  return (
    <div className="flex gap-2 items-center">
      {thicknesses.map((size) => (
        <button
          key={size}
          className={`rounded-full ${
            size === thickness ? "bg-black" : "bg-gray-400"
          }`}
          style={{ width: size * 10 + "px", height: size * 10 + "px" }}
          onClick={() => setThickness(size)}
        />
      ))}
    </div>
  );
};
