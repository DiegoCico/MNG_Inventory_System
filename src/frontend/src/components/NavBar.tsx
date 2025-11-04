import React from "react";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CheckBoxBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import OutboxIcon from "@mui/icons-material/Outbox";
import { useNavigate, useLocation } from "react-router-dom";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentValue =
    location.pathname === "/home"
      ? "home"
      : location.pathname === "/to-review"
      ? "toReview"
      : location.pathname === "/reviewed"
      ? "reviewed"
      : location.pathname === "/send"
      ? "send"
      : "";

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    switch (newValue) {
      case "home":
        navigate("/home");
        break;
      case "toReview":
        navigate("/to-review");
        break;
      case "reviewed":
        navigate("/reviewed");
        break;
      case "send":
        navigate("/send");
        break;
      default:
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
        zIndex: 1200,
        borderTop: "1px solid rgba(0,0,0,0.1)",
      }}
      elevation={3}
    >
      <BottomNavigation
        showLabels
        value={currentValue}
        onChange={handleChange}
        sx={{
          height: 56,
          "& .MuiBottomNavigationAction-label": { fontSize: "0.75rem" },
        }}
      >
        <BottomNavigationAction label="Home" value="home" icon={<HomeIcon />} />
        <BottomNavigationAction
          label="To Review"
          value="toReview"
          icon={<CheckBoxBlankIcon />}
        />
        <BottomNavigationAction
          label="Reviewed"
          value="reviewed"
          icon={<CheckBoxIcon />}
        />
        <BottomNavigationAction
          label="Send"
          value="send"
          icon={<OutboxIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
