import React, { useState, useEffect, useRef } from "react";
export default function AutocompleteInput({ value, onChange, placeholder, className, style, fieldType }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!value || value.length < 2 || value === selectedItem) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch("http://localhost:8000/api/food/suggest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            field_type: fieldType,
            partial_text: value
          })
        });
        const data = await response.json();
        if (data && data.suggestions) {
          setSuggestions(data.suggestions);
          setShowDropdown(data.suggestions.length > 0);
        }
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [value, fieldType, selectedItem]);

  const handleSelect = (item) => {
    setSelectedItem(item);
    onChange({ target: { value: item } });
    setShowDropdown(false);
  };
  
  const handleChange = (e) => {
    setSelectedItem(null); // Clear selected item when user modifies text manually
    onChange(e);
  };

  return (
    <div style={{ position: "relative", width: "100%", zIndex: 50 }} ref={dropdownRef}>
      <input
        className={className}
        style={style}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        // Removed onFocus dropdown trigger as requested
      />
      {showDropdown && suggestions.length > 0 && (
        <ul style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          zIndex: 9999,
          listStyle: "none",
          margin: "4px 0 0 0",
          padding: 0,
          maxHeight: 200,
          overflowY: "auto"
        }}>
          {suggestions.map((item, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(item)}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                borderBottom: idx < suggestions.length - 1 ? "1px solid #f1f5f9" : "none",
                fontSize: 14,
                color: "#1e293b",
                background: "white",
                transition: "background 0.15s"
              }}
              onMouseEnter={(e) => e.target.style.background = "#f8fafc"}
              onMouseLeave={(e) => e.target.style.background = "white"}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
