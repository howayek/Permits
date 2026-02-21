import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Clock, Shield, Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasShownToast = useRef(false);

  useEffect(() => {
    // Check if user was redirected here after permit submission
    if (location.state?.permitSubmitted && !hasShownToast.current) {
      const permitType = location.state?.submittedPermitType || "permit";
      toast({
        title: "Permit Request Submitted Successfully",
        description: `Your ${permitType} request has been successfully sent. You will receive an update shortly on the decision.`,
      });
      
      // Mark toast as shown and clear navigation state
      hasShownToast.current = true;
      navigate("/", { replace: true });
    }
  }, [location.state, toast, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header handles navigation now */}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero py-20 md:py-32">
        <div className="container mx-auto px-4 text-center relative">
          <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6">
            Digital Permit Applications
          </h1>
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 max-w-3xl mx-auto">
            Transparent, efficient, and corruption-free permit processing for Lebanon
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {/* Redirects to the same route as the Header "My dashboard" */}
            <Link to="/dashboard">
              <Button size="lg">
                Get Started
              </Button>
            </Link>

            {/* Renamed from Track Status -> My Permits and pointed to /my-permits */}
            <Link to="/my-permits">
              <Button size="lg" variant="outline">
                My Permits
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-foreground">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 bg-gradient-card border-border/50 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-card-foreground">Submit Application</h3>
              <p className="text-muted-foreground">
                Fill out your permit application online and upload required documents securely
              </p>
            </Card>

            <Card className="p-6 bg-gradient-card border-border/50 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-card-foreground">Track Progress</h3>
              <p className="text-muted-foreground">
                Monitor your application status in real-time with complete transparency
              </p>
            </Card>

            <Card className="p-6 bg-gradient-card border-border/50 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-card-foreground">Secure Processing</h3>
              <p className="text-muted-foreground">
                Your data is protected with bank-level encryption and security measures
              </p>
            </Card>

            <Card className="p-6 bg-gradient-card border-border/50 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-success" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-card-foreground">Government Review</h3>
              <p className="text-muted-foreground">
                Municipal staff review applications efficiently through dedicated portal
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 Lebanon Digital Permits. Modernizing governance for all citizens.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;