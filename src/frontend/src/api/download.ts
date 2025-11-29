import { trpcFetch } from './utils';

const TRPC = '/trpc';

/**
 * Helper function to download CSV content as a file
 */
export const downloadCSV = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Helper function to download PDF from base64 data or S3 URL
 */
export const downloadPDF = async (pdfData: string, filename: string, isBase64: boolean = false) => {
  try {
    let blob: Blob;
    
    if (isBase64) {
      // Convert base64 to blob
      const binaryString = atob(pdfData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'application/pdf' });
    } else {
      // Fetch from URL
      const response = await fetch(pdfData);
      blob = await response.blob();
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download PDF:', error);
    throw error;
  }
};

/**
 * Main function to generate export documents
 * Calls the backend export script and returns the data (does NOT auto-download)
 */
export const generateExportDocuments = async (teamId: string) => {
  try {
    // Call backend to run Python scripts and generate files
    const result = await trpcFetch(`${TRPC}/getExport`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    });

    if (!result) {
      throw new Error('No response from backend');
    }

    if (!result.success) {
      throw new Error(result?.error || 'Export failed');
    }

    return {
      success: true,
      pdf2404: result.pdf2404,
      csvInventory: result.csvInventory,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message || 'Failed to generate documents');
    }
    throw new Error('Failed to generate documents');
  }
};