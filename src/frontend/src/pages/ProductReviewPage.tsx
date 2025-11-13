/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Snackbar,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import NavBar from "../components/NavBar";
import ImagePanel from "../components/ImagePanel";
import ItemDetailsForm from "../components/ItemDetailsForm";
import DamageReportsSection from "../components/DamageReportsSection";
import ActionPanel from "../components/ActionPanel";
import { flattenTree } from "../components/Producthelpers";
import { getItem, getItems } from "../api/items";
import ChildrenTree from "../components/ChildrenTree";
import TopBar from "../components/TopBar";
import Profile from "../components/Profile";

export default function ProductReviewPage() {
  const { teamId, itemId } = useParams<{ teamId: string; itemId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const isCreateMode = itemId === "new";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // shared item state
  const [product, setProduct] = useState<any>(null);
  const [editedProduct, setEditedProduct] = useState<any>(null);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [imagePreview, setImagePreview] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [damageReports, setDamageReports] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [isEditMode, setIsEditMode] = useState(isCreateMode);
  const [showSuccess, setShowSuccess] = useState(false);

  // Profile state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!teamId) throw new Error("Missing team ID");
        const all = await getItems(teamId);
        if (all.success && all.items) {
          const flat = flattenTree(all.items);
          setItemsList(flat.filter((x: any) => x.itemId !== itemId));
        }

        if (isCreateMode) {
          const blank = {
            productName: "",
            actualName: "",
            description: "",
            serialNumber: "",
            quantity: 1,
            status: "To Review",
          };
          setProduct(blank);
          setEditedProduct(blank);
          setLoading(false);
          return;
        }

        const res = await getItem(teamId, itemId!);
        if (!res.success || !res.item) throw new Error(res.error);

        const item = res.item;

        // Manually find children from the full items list
        const allItemsRes = await getItems(teamId);
        if (allItemsRes.success && allItemsRes.items) {
          const children = allItemsRes.items.filter((i: any) => i.parent === itemId);
          item.children = children; // Add children to item
        }

        setProduct(item);
        setEditedProduct(item);
        setDamageReports(item.damageReports || []);

        if (item.imageLink && item.imageLink.startsWith("http")) {
          setImagePreview(item.imageLink);
        } else {
          setImagePreview("");
        }
      } catch (err: any) {
        console.error("[ProductReviewPage] Error loading item:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId, itemId]);

  const handleProfileImageChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === "string") {
        setProfileImage(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading)
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
        sx={{ bgcolor: theme.palette.background.default }}
      >
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.palette.background.default, display: "flex", flexDirection: "column" }}>
      <TopBar
        isLoggedIn={true}
        profileImage={profileImage}
        onProfileClick={() => setProfileOpen(true)}
      />

      <Box
        sx={{
          flex: 1,
          bgcolor: theme.palette.background.default,
          pb: 10,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            pt: 3,
            pb: 8,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 3,
            boxShadow: theme.palette.mode === "dark" ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.05)",
            mt: 3,
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              textTransform: "none",
              color: theme.palette.text.secondary,
              mb: 2,
              "&:hover": {
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)",
              },
            }}
          >
            Back
          </Button>

          {/* === Main Content === */}
          <Grid
            container
            spacing={3}
            justifyContent="center"
            alignItems="flex-start"
          >
            {/* === LEFT: IMAGE === */}
            <Grid item xs={12} md={4}>
              <ImagePanel
                imagePreview={imagePreview}
                setImagePreview={setImagePreview}
                setSelectedImageFile={setSelectedImageFile}
                isEditMode={isEditMode}
                isCreateMode={isCreateMode}
              />
            </Grid>

            {/* === CENTER: ITEM DETAILS === */}
            <Grid item xs={12} md={5}>
              <ItemDetailsForm
                editedProduct={editedProduct}
                setEditedProduct={setEditedProduct}
                itemsList={itemsList}
                isEditMode={isEditMode}
                alwaysEditableFields={["status", "description", "notes"]}
              />

              {editedProduct?.status === "Damaged" && (
                <DamageReportsSection
                  isEditMode={true}
                  editedProduct={editedProduct}
                  damageReports={damageReports}
                  setDamageReports={setDamageReports}
                />
              )}

              <ChildrenTree editedProduct={editedProduct} teamId={teamId!} />
            </Grid>

            {/* === RIGHT: ACTIONS === */}
            <Grid item xs={12} md={3}>
              <ActionPanel
                isCreateMode={isCreateMode}
                isEditMode={isEditMode}
                setIsEditMode={setIsEditMode}
                product={product}
                editedProduct={editedProduct}
                teamId={teamId!}
                itemId={itemId!}
                selectedImageFile={selectedImageFile}
                imagePreview={imagePreview}
                setShowSuccess={setShowSuccess}
              />
            </Grid>
          </Grid>

          <Snackbar
            open={showSuccess}
            autoHideDuration={3000}
            onClose={() => setShowSuccess(false)}
          >
            <Alert severity="success">Item updated successfully!</Alert>
          </Snackbar>
        </Container>
      </Box>

      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />

      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          bgcolor: theme.palette.background.paper,
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 -2px 8px rgba(0,0,0,0.6)"
              : "0 -2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <NavBar />
      </Box>
    </Box>
  );
}
