/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import {
  Box, Button, Container, Snackbar, Alert, CircularProgress, Grid,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import ImagePanel from "../components/ImagePanel";
import ItemDetailsForm from "../components/ItemDetailsForm";
import DamageReportsSection from "../components/DamageReportsSection";
import ActionPanel from "../components/ActionPanel";
import { flattenTree } from "../components/Producthelpers";
import { getItem, getItems} from "../api/items";

export default function ProductReviewPage() {
  const { teamId, itemId } = useParams<{ teamId: string; itemId: string }>();
  const navigate = useNavigate();
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
            status: "Incomplete",
          };
          setProduct(blank);
          setEditedProduct(blank);
          setLoading(false);
          return;
        }

        const res = await getItem(teamId, itemId!);
        if (!res.success || !res.item) throw new Error(res.error);

        const item = res.item;
        setProduct(item);
        setEditedProduct(item);
        setDamageReports(item.damageReports || []);

        if (item.imageLink && item.imageLink.startsWith("http")) {
          console.log("[ProductReviewPage] Loaded image:", item.imageLink);
          setImagePreview(item.imageLink);
        } else {
          console.log("[ProductReviewPage] No image found for item");
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

  if (loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
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
  <Box
    sx={{
      minHeight: "100vh",
      bgcolor: "linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)",
      pb: 10,
    }}
  >
    <Container
      maxWidth="lg"
      sx={{
        pt: 3,
        pb: 8,
        backgroundColor: "white",
        borderRadius: 3,
        boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
        mt: 3,
      }}
    >
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{
          textTransform: "none",
          color: "text.secondary",
          mb: 2,
          "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
        }}
      >
        Back
      </Button>

      {/* === Main Content === */}
      <Grid container spacing={3} justifyContent="center" alignItems="flex-start">
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
          <DamageReportsSection
            isEditMode={true} // always allow adding damage notes
            editedProduct={editedProduct}
            damageReports={damageReports}
            setDamageReports={setDamageReports}
          />
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


      <Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)}>
        <Alert severity="success">Item updated successfully!</Alert>
      </Snackbar>
    </Container>
    <NavBar />
  </Box>
);
}
