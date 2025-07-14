import React from "react";
import ReactDOM from "react-dom/client";
import TopicificatorApp from "../components/TopicificatorApp";
import "/styles/tailwind.css";

const container = document.getElementById("topicificator-root");
if (container) {
  ReactDOM.createRoot(container).render(<TopicificatorApp />);
}