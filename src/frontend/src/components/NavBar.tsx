// components/BottomNav.tsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CheckBoxBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import OutboxIcon from "@mui/icons-material/Outbox";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Set the active tab based on current route
  const getValueFromPath = () => {
    const path = location.pathname;
    if (path === "/") return "home";
    if (path.includes("/to-review")) return "toReview";
    if (path.includes("/reviewed")) return "reviewed";
    if (path.includes("/send")) return "send";
    return "home";
  };

  const [value, setValue] = React.useState(getValueFromPath());

  const handleNavigation = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
    
    switch (newValue) {
      case "home":
        navigate("/home");
        break;
      case "toReview":
        navigate("/product/item");
        break;
      case "reviewed":
        navigate("/reviewed");
        break;
      case "send":
        navigate("/send");
        break;
    }
  };

  return (
    <Paper
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        "& .MuiBottomNavigationAction-label": {
          fontSize: "0.75rem",
          transition: "none",
        }
      }}
      elevation={3}
    >
      <BottomNavigation
        showLabels
        value={value}
        onChange={handleNavigation}
      >
        <BottomNavigationAction label="Home" value="home" icon={<HomeIcon />} />
        <BottomNavigationAction label="To Review" value="toReview" icon={<CheckBoxBlankIcon />} />
        <BottomNavigationAction label="Reviewed" value="reviewed" icon={<CheckBoxIcon />} />
        <BottomNavigationAction label="Send" value="send" icon={<OutboxIcon />} />
      </BottomNavigation>
    </Paper>
  );
}