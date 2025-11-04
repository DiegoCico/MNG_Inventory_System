import {
  Card,
  CardActionArea,
  CardContent,
  Avatar,
  Stack,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { MouseEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

export interface TeamIconProps {
  id: string;
  name: string;
  description?: string;
  onInvite?: (workspaceName: string) => void;
  onRemove?: (workspaceName: string) => void;
  onDelete?: (workspaceName: string) => void;
}

export default function TeamIcon({
  id,
  name,
  description,
  onInvite,
  onRemove,
  onDelete,
}: TeamIconProps) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);
  const handleOpenTeam = () => navigate(`/teams/${id}`);

  const blue = "#283996";
  const borderColor = alpha("#000", 0.08);

  return (
    <>
      <Card
        sx={{
          borderRadius: 3,
          bgcolor: "white",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          transition: "all 0.25s ease",
          cursor: "pointer",
          "&:hover": {
            transform: "translateY(-5px)",
            borderColor: blue,
            boxShadow: "0 8px 24px rgba(40,57,150,0.15)",
          },
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          p: 2,
        }}
      >
        <CardActionArea
          onClick={handleOpenTeam}
          sx={{
            borderRadius: 3,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CardContent>
            <Stack alignItems="center" spacing={1.4}>
              <Avatar
                variant="rounded"
                sx={{
                  width: 64,
                  height: 64,
                  fontWeight: 800,
                  bgcolor: alpha(blue, 0.15),
                  color: blue,
                  fontSize: 22,
                }}
              >
                {getInitials(name)}
              </Avatar>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  color: "#1a1a1a",
                  textAlign: "center",
                  maxWidth: 180,
                }}
                noWrap
              >
                {name}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "#6b6b6b",
                  fontSize: 13,
                  textAlign: "center",
                  maxWidth: 200,
                }}
                noWrap
              >
                {description || "No description"}
              </Typography>
            </Stack>
          </CardContent>
        </CardActionArea>

        <IconButton
          size="small"
          onClick={handleMenu}
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            color: "#666",
            "&:hover": { color: blue },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            handleClose();
            handleOpenTeam();
          }}
        >
          Open
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            onInvite?.(name);
          }}
        >
          Invite Member
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleClose();
            onRemove?.(name);
          }}
          sx={{ color: "error.main" }}
        >
          Remove Member
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            onDelete?.(name);
          }}
          sx={{ color: "error.main" }}
        >
          Delete Teamspace
        </MenuItem>
      </Menu>
    </>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
