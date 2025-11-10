import React from "react";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CheckBoxBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import OutboxIcon from "@mui/icons-material/Outbox";
import { useNavigate, useLocation, useParams } from "react-router-dom";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamId } = useParams<{ teamId: string }>();

  const currentValue =
    location.pathname.includes(`/teams/home/${teamId}`)
      ? "home"
      : location.pathname.includes(`/teams/to-review/${teamId}`)
        ? "toReview"
        : location.pathname.includes(`/teams/reviewed/${teamId}`)
          ? "reviewed"
          : location.pathname.includes(`/teams/send/${teamId}`)
            ? "send"
            : "";

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    if (!teamId) {
      console.warn('No teamId available for navigation');
      return;
    }

    switch (newValue) {
      case "home":
        navigate(`/teams/home/${teamId}`);
        break;
      case "toReview":
        navigate(`/teams/to-review/${teamId}`);
        break;
      case "reviewed":
        navigate(`/teams/reviewed/${teamId}`);
        break;
      case "export":
        navigate("/teams/export/:teamId");
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
          label="Export"
          value="export"
          icon={<OutboxIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
