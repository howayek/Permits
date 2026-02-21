import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BLOB_CLEANUP_DELAY = 1000; // milliseconds

// Allowed MIME types for PDF downloads
const ALLOWED_PDF_MIME_TYPES = ['application/pdf', 'application/octet-stream'];

// Type guard to check if a value is a Response-like object
function isResponseLike(value: unknown): value is Response {
  return (
    value !== null &&
    typeof value === 'object' &&
    'headers' in value &&
    'bodyUsed' in value &&
    typeof (value as Response).json === 'function' &&
    typeof (value as Response).text === 'function'
  );
}

// Helper function to check if error is a network/connection error
function isNetworkError(error: { message?: string }): boolean {
  if (!error.message) return false;
  const networkErrorPatterns = [
    'fetch',
    'network',
    'ECONNREFUSED',
    'Failed to fetch',
    'NetworkError',
    'ERR_CONNECTION'
  ];
  return networkErrorPatterns.some(pattern => 
    error.message!.toLowerCase().includes(pattern.toLowerCase())
  );
}

// Helper function to provide user-friendly error messages for common Edge Function errors
function getUserFriendlyErrorMessage(errorMessage: unknown): string {
  // Convert to string with fallback for null/undefined
  const message = typeof errorMessage === 'string' ? errorMessage : String(errorMessage || 'Unknown error');
  
  if (message.includes("SUPABASE_URL") || message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "PDF generation service is not properly configured. The administrator needs to set up required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).";
  } else if (message.includes("PERMITS_BASE_URL")) {
    return "PDF generation service configuration error. The administrator needs to set PERMITS_BASE_URL environment variable.";
  } else if (message.includes("Permit not found")) {
    return "Permit not found. Please refresh the page and try again.";
  } else if (message.includes("QR")) {
    return "Failed to generate QR code for the permit. Please try again.";
  } else if (message.includes("base URL")) {
    return "PDF generation service configuration error. Please contact the administrator.";
  }
  
  return message;
}

interface GeneratePermitButtonProps {
  permitId: string;
  onSuccess?: (response: unknown) => void;
  confirm?: boolean;
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function GeneratePermitButton({
  permitId,
  onSuccess,
  confirm = true,
  className,
  label = "Generate PDF",
  disabled = false,
}: GeneratePermitButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleGenerate() {
    if (confirm && !window.confirm("Generate official permit PDF? This will create the final permit document.")) {
      return;
    }

    setLoading(true);

    try {
      console.log("Invoking generate-permit function with permitId:", permitId);
      console.log("Supabase functions endpoint:", (supabase as unknown as { functions?: { url?: string } }).functions?.url || 'default');
      
      const { data, error } = await supabase.functions.invoke("generate-permit", {
        body: { permitId },
      });

      console.log("Function response - data:", data, "error:", error);

      // Check for network/invocation errors
      if (error) {
        console.error("Supabase function invocation error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        
        // Check if this is a network error (local Supabase not running)
        if (isNetworkError(error)) {
          throw new Error("Cannot connect to Edge Function. If you're running locally, make sure Supabase is started with 'supabase start'. Otherwise, check your network connection.");
        }
        
        // For FunctionsHttpError, try to extract the actual error message from the response
        let errorMessage = "Function invocation failed";
        if (error.message) {
          errorMessage = error.message;
        }
        
        // Check if error has a context property that looks like a Response
        // Using type guard for more robust detection
        const context = error.context;
        if (isResponseLike(context)) {
          // Check if the response body hasn't been consumed yet
          if (!context.bodyUsed) {
            try {
              const contentType = context.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const responseData = await context.json();
                console.error("Error response data:", responseData);
                
                if (responseData && responseData.error) {
                  // Use the actual error from the Edge Function response
                  errorMessage = getUserFriendlyErrorMessage(responseData.error);
                }
              } else {
                console.error("Non-JSON error response, content-type:", contentType);
                const textResponse = await context.text();
                console.error("Response text:", textResponse);
                if (textResponse) {
                  errorMessage = getUserFriendlyErrorMessage(textResponse);
                }
              }
            } catch (parseError) {
              console.error("Failed to parse error response:", parseError);
            }
          } else {
            console.warn("Response body already consumed, cannot extract error details");
          }
        }
        
        throw new Error(errorMessage);
      }

      // Check if data is null or undefined
      if (!data) {
        console.error("No data returned from function");
        throw new Error("No response received from the PDF generation service");
      }

      // Check for application-level errors in the response
      if (data.error) {
        console.error("Application error in response:", data.error);
        throw new Error(getUserFriendlyErrorMessage(data.error));
      }

      // Check for success indicator
      if (data.ok) {
        console.log("PDF generation successful, pdf_s3_key:", data.pdf_s3_key);
        
        // PDF was generated successfully, now download it
        const pdfS3Key = data.pdf_s3_key;
        let downloadSucceeded = false;
        
        if (pdfS3Key) {
          downloadSucceeded = await downloadGeneratedPDF(pdfS3Key);
        }
        
        if (downloadSucceeded) {
          toast({
            title: "Success",
            description: "PDF generated and downloaded successfully!",
          });
        } else {
          toast({
            title: "PDF Generated",
            description: "PDF generated successfully. You can download it from the permits list.",
          });
        }
        
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        // Response doesn't have ok: true, which is unexpected
        console.error("Unexpected response format - missing 'ok: true':", data);
        throw new Error("Unexpected response from PDF generation service. Please check the browser console for details.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate permit PDF";
      console.error("Generate permit error details:", err);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function downloadGeneratedPDF(key: string): Promise<boolean> {
    try {
      console.log("Attempting to download PDF from storage, key:", key);
      console.log("Storage bucket: documents");
      
      const { data, error } = await supabase.storage.from("documents").download(key);
      
      if (error) {
        console.error("Storage download error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        
        // Provide helpful error message for common issues
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          throw new Error(`PDF file not found in storage. The file may not have been uploaded correctly. Key: ${key}`);
        } else if (error.message?.includes('permission') || error.message?.includes('403')) {
          throw new Error("Permission denied. You may not have access to download this file.");
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          throw new Error("Network error while downloading PDF. Please check your connection.");
        }
        
        throw error;
      }
      
      if (!data) {
        console.error("No data received from storage download");
        throw new Error("No data received from storage");
      }
      
      console.log("PDF downloaded successfully, size:", data.size, "type:", data.type);
      
      // Verify the blob is valid
      if (data.size === 0) {
        console.error("Downloaded file is empty (0 bytes)");
        throw new Error("Downloaded PDF file is empty");
      }
      
      // Verify it's actually a PDF
      if (data.type && !ALLOWED_PDF_MIME_TYPES.includes(data.type)) {
        console.warn("Downloaded file has unexpected MIME type:", data.type);
      }
      
      // Create a blob URL and trigger download
      const url = URL.createObjectURL(data);
      console.log("Created blob URL:", url);
      
      const link = document.createElement("a");
      link.href = url;
      const filename = key.split("/").pop() || "permit.pdf";
      link.download = filename;
      
      console.log("Triggering download for file:", filename);
      
      // Add the link to the DOM, click it, then remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("Download link clicked, should start downloading");
      console.log("Check your browser's Downloads folder or download bar for:", filename);
      
      // Clean up the blob URL after enough time for the download to start
      setTimeout(() => {
        console.log("Cleaning up blob URL");
        URL.revokeObjectURL(url);
      }, BLOB_CLEANUP_DELAY);
      
      return true;
    } catch (e) {
      console.error("Failed to download PDF, error details:", e);
      toast({
        title: "Download Error",
        description: e instanceof Error ? e.message : "Failed to download the generated PDF",
        variant: "destructive",
      });
      return false;
    }
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={disabled || loading}
      className={className}
      size="sm"
    >
      {loading ? "Generating..." : label}
    </Button>
  );
}
