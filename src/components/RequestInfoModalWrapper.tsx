import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { RequestInfoModal } from "@/components/RequestInfoModal";

interface RequestInfoModalWrapperProps {
  appId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestInfoModalWrapper({ appId, onClose, onSuccess }: RequestInfoModalWrapperProps) {
  const [app, setApp] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("applications")
          .select("*, permit_types(name,slug,municipality_id)")
          .eq("id", appId)
          .maybeSingle();
        if (error) throw error;
        setApp(data);
      } catch (err) {
        console.error("Failed to fetch application:", err);
        toast({
          title: "Error",
          description: "Failed to load application data",
          variant: "destructive",
        });
        onClose();
      }
    })();
  }, [appId, toast, onClose]);

  if (!app) return null;

  return (
    <RequestInfoModal
      applicationId={appId}
      applicationData={app.data}
      open={true}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
