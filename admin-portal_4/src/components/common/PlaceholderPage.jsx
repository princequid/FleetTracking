import React from "react";

export default function PlaceholderPage({ icon: Icon, title }) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-card">
        {Icon && <Icon size={48} className="placeholder-icon" />}
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-subtitle">This page is under construction</p>
      </div>
    </section>
  );
}
