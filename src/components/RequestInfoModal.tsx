import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatFieldLabel } from "@/lib/utils";
import { APPLICATION_STATUSES } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface RequestInfoModalProps {
  applicationId: string;
  applicationData: any;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestInfoModal({
  applicationId,
  applicationData,
  open,
  onClose,
  onSuccess,
}: RequestInfoModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [requiresNewDocs, setRequiresNewDocs] = useState(false);

  // Extract available fields from application data
  const availableFields = applicationData?.fields
    ? Object.keys(applicationData.fields)
    : [];

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((f) => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleSubmit = async () => {
    if (selectedFields.length === 0 && !instructions.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select at least one field or provide instructions.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Insert info request
      const { error: insertError } = await supabase.from("info_requests").insert({
        application_id: applicationId,
        requested_by: user?.id,
        requested_fields: selectedFields,
        message: instructions.trim() || null,
        due_date: dueDate?.toISOString() ?? null,
        requires_new_documents: requiresNewDocs,
      });

      if (insertError) throw insertError;

      // Update application status
      const { error: updateError } = await supabase
        .from("applications")
        .update({ status: APPLICATION_STATUSES.CLARIFICATION_REQUESTED })
        .eq("id", applicationId);

      if (updateError) throw updateError;

      // Log audit entry
      const { error: auditError } = await supabase.from("audit_log").insert({
        application_id: applicationId,
        action: "REQUEST_INFO",
        meta: {
          requested_by: user?.email,
          requested_fields: selectedFields,
          message: instructions.trim() || null,
          due_date: dueDate?.toISOString() ?? null,
          requires_new_documents: requiresNewDocs,
        },
      });

      if (auditError) throw auditError;

      toast({
        title: "Success",
        description: "Information request sent to citizen.",
      });

      // Reset form
      setSelectedFields([]);
      setInstructions("");
      setDueDate(undefined);
      setRequiresNewDocs(false);

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error submitting info request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit information request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Additional Information</DialogTitle>
          <DialogDescription>
            Select which fields need clarification and provide instructions for the citizen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              Select Fields to Request
            </Label>
            {availableFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fields available in this application.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {availableFields.map((fieldKey) => (
                  <div key={fieldKey} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${fieldKey}`}
                      checked={selectedFields.includes(fieldKey)}
                      onCheckedChange={() => handleFieldToggle(fieldKey)}
                    />
                    <label
                      htmlFor={`field-${fieldKey}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {formatFieldLabel(fieldKey)}
                    </label>
                  </div>
                ))}
              </div>
            )}
            {selectedFields.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedFields.length} field{selectedFields.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Instructions */}
          <div>
            <Label htmlFor="instructions" className="text-base font-semibold">
              Instructions for Citizen
            </Label>
            <Textarea
              id="instructions"
              placeholder="Explain what information is needed, provide examples, or include helpful links..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="mt-2 min-h-[120px]"
            />
          </div>

          {/* Due Date */}
          <div>
            <Label className="text-base font-semibold mb-2 block">
              Due Date (Optional)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${
                    !dueDate && "text-muted-foreground"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Select a due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Requires New Documents */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requires-docs"
              checked={requiresNewDocs}
              onCheckedChange={(checked) => setRequiresNewDocs(checked as boolean)}
            />
            <label
              htmlFor="requires-docs"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Requires new documents
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
