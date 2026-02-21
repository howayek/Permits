import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const CitizenPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [permitType, setPermitType] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    checkAuth();
    fetchApplications();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "citizen");

    if (!roles || roles.length === 0) {
      toast({
        title: "Access Denied",
        description: "You don't have citizen access.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setUser(user);
    setLoading(false);
  };

  const fetchApplications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
      return;
    }

    if (data) {
      setApplications(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase
        .from("applications")
        .insert({
          user_id: user.id,
          permit_type: permitType,
          applicant_name: applicantName,
          contact_info: contactInfo,
          address,
          description,
          status: "pending",
        });

      if (error) throw error;

      // Store permit type before resetting form
      const submittedPermitType = permitType;

      // Reset form
      setPermitType("");
      setApplicantName("");
      setContactInfo("");
      setAddress("");
      setDescription("");

      // Navigate to home page with success state
      navigate("/", {
        state: {
          permitSubmitted: true,
          submittedPermitType,
        },
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-pending text-pending-foreground">Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-destructive text-destructive-foreground">Needs Revision</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Citizen Portal</h1>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Application Form */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6">Submit New Application</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="permitType">Permit Type</Label>
                <Select value={permitType} onValueChange={setPermitType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select permit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Building Permit">Building Permit</SelectItem>
                    <SelectItem value="Business License">Business License</SelectItem>
                    <SelectItem value="Renovation Permit">Renovation Permit</SelectItem>
                    <SelectItem value="Event Permit">Event Permit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Applicant Name</Label>
                <Input
                  id="name"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="Full Name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Information</Label>
                <Input
                  id="contact"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Email or Phone"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Property Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street Address, City"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Project Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your project..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documents">Upload Documents</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, PNG, JPG (max 10MB)
                  </p>
                </div>
              </div>

              <Button type="submit" className="w-full">
                Submit Application
              </Button>
            </form>
          </Card>

          {/* Existing Applications */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">Your Applications</h2>
              <div className="space-y-4">
                {applications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No applications yet. Submit your first application to get started.
                  </p>
                ) : (
                  applications.map((app) => (
                    <div
                      key={app.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {app.id.slice(0, 8)}
                          </p>
                          <h3 className="font-semibold">{app.permit_type}</h3>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {new Date(app.submitted_at).toLocaleDateString()}
                      </p>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-6 bg-muted/50">
              <h3 className="font-semibold mb-3">📋 Required Documents</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Property title or lease agreement</li>
                <li>• Architectural plans (if applicable)</li>
                <li>• Valid identification</li>
                <li>• Previous permits (for renovations)</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenPortal;
