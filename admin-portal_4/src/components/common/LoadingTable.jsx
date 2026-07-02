import React from "react";

export default function LoadingTable({ columns = 5, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="skeleton-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex}>
              <div className="skeleton-bar" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
